package page.harvis.horsepredictor.prediction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BacktestEngineTest {

    private static final Instant FIRST = Instant.parse("2026-10-01T04:00:00Z");
    private static final Instant SECOND = Instant.parse("2026-10-08T04:00:00Z");
    private static final UUID RACE_ONE = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID RACE_TWO = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final UUID HORSE_A = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final UUID HORSE_B = UUID.fromString("00000000-0000-0000-0000-0000000000b1");
    private static final UUID RUNNER_A1 = UUID.fromString("00000000-0000-0000-0000-000000000111");
    private static final UUID RUNNER_B1 = UUID.fromString("00000000-0000-0000-0000-000000000112");
    private static final UUID RUNNER_A2 = UUID.fromString("00000000-0000-0000-0000-000000000121");
    private static final UUID RUNNER_B2 = UUID.fromString("00000000-0000-0000-0000-000000000122");

    @Test
    void emptyHistoryDoesNotInventMetrics() {
        BacktestReport report = BacktestEngine.run(List.of());

        assertThat(report.status()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(report.racesScored()).isZero();
        assertThat(report.evidence().logLoss()).isNull();
        assertThat(report.evidence().brierScore()).isNull();
        assertThat(report.evidence().topRankedStrikeRate()).isNull();
        assertThat(report.calibration()).isEmpty();
        assertThat(report.limitations()).anyMatch(note -> note.contains("No profitability"));
    }

    @Test
    void chronologicalReplayScoresOnlyTheLaterRaceAndBeatsTheEqualBaselineOnLogLoss() {
        CompletedRace first = completed(RACE_ONE, FIRST, RUNNER_A1, RUNNER_B1, 1, 2, List.of());
        CompletedRace second = completed(
                RACE_TWO,
                SECOND,
                RUNNER_A2,
                RUNNER_B2,
                1,
                2,
                List.of(
                        new OddsQuoteView(RUNNER_A2, SECOND.minusSeconds(60), new BigDecimal("2.000")),
                        new OddsQuoteView(RUNNER_B2, SECOND.minusSeconds(60), new BigDecimal("2.000")),
                        new OddsQuoteView(RUNNER_B2, SECOND.plusSeconds(60), new BigDecimal("1.010")),
                        new OddsQuoteView(RUNNER_A2, null, new BigDecimal("1.200"))));

        BacktestReport report = BacktestEngine.run(List.of(second, first));

        assertThat(report.status()).isEqualTo("CALCULATED");
        assertThat(report.racesSupplied()).isEqualTo(2);
        assertThat(report.racesScored()).isEqualTo(1);
        assertThat(report.evidence().topRankedStrikeRate()).isEqualByComparingTo("1.0000");
        assertThat(report.evidence().logLoss()).isLessThan(report.baseline().logLoss());
        assertThat(report.baseline().logLoss()).isEqualByComparingTo(BigDecimal.valueOf(-Math.log(0.5)).setScale(6, java.math.RoundingMode.HALF_UP));
        assertThat(report.byCountry()).extracting(SliceScore::key).containsExactly("AU");
        assertThat(report.byDistance()).extracting(SliceScore::key).contains("distance unavailable");
        assertThat(report.byRaceType()).extracting(SliceScore::key).containsExactly("flat");
        assertThat(report.oddsBenchmark().status()).isEqualTo("CALCULATED");
        assertThat(report.oddsBenchmark().ignoredFutureQuotes()).isEqualTo(1);
        assertThat(report.oddsBenchmark().ignoredUntimestampedQuotes()).isEqualTo(1);
        assertThat(report.oddsBenchmark().logLoss()).isEqualByComparingTo(report.baseline().logLoss());
        assertThat(report.limitations()).anyMatch(note -> note.contains("Fewer than 30"));
        assertThat(report.calibration()).isNotEmpty();
    }

    @Test
    void overlappingWindowsAreRejected() {
        assertThatThrownBy(() -> BacktestEngine.requireSeparated(SECOND, FIRST))
                .isInstanceOf(OverlappingWindowException.class);
        assertThatThrownBy(() -> BacktestEngine.requireSeparated(SECOND, SECOND))
                .isInstanceOf(OverlappingWindowException.class);
    }

    @Test
    void evaluationWindowDoesNotScoreTrainingRaces() {
        CompletedRace first = completed(RACE_ONE, FIRST, RUNNER_A1, RUNNER_B1, 1, 2, List.of());
        CompletedRace second = completed(RACE_TWO, SECOND, RUNNER_A2, RUNNER_B2, 1, 2, List.of());
        BacktestEngine.requireSeparated(FIRST, SECOND);

        BacktestReport report = BacktestEngine.run(List.of(first, second), SECOND);

        assertThat(report.racesScored()).isEqualTo(1);
        assertThat(report.evidence().topRankedStrikeRate()).isEqualByComparingTo("1.0000");
    }

    private static CompletedRace completed(
            UUID raceId,
            Instant offTime,
            UUID runnerA,
            UUID runnerB,
            int positionA,
            int positionB,
            List<OddsQuoteView> quotes) {
        RaceToPredict race = new RaceToPredict(
                raceId,
                offTime,
                "AU",
                null,
                null,
                null,
                null,
                null,
                "flat",
                List.of(
                        new DeclaredRunner(runnerA, HORSE_A, null, null, null, null, false),
                        new DeclaredRunner(runnerB, HORSE_B, null, null, null, null, false)));
        return new CompletedRace(race, Map.of(runnerA, positionA, runnerB, positionB), quotes);
    }
}
