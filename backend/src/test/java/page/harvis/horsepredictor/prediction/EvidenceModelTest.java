package page.harvis.horsepredictor.prediction;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EvidenceModelTest {

    private static final Instant CUTOFF = Instant.parse("2026-10-19T08:00:00Z");
    private static final UUID RACE_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
    private static final UUID HORSE_A = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final UUID HORSE_B = UUID.fromString("00000000-0000-0000-0000-0000000000b1");
    private static final UUID RUNNER_A = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
    private static final UUID RUNNER_B = UUID.fromString("00000000-0000-0000-0000-0000000000b2");
    private static final UUID RUNNER_C = UUID.fromString("00000000-0000-0000-0000-0000000000c2");

    @Test
    void probabilitiesSumToOneAndRankTheHorseWithMoreWins() {
        RaceToPredict race = race(List.of(runner(RUNNER_A, HORSE_A, false), runner(RUNNER_B, HORSE_B, false)));
        List<HistoricalStart> history = List.of(
                start(HORSE_A, CUTOFF.minusSeconds(86400), 1, null),
                start(HORSE_B, CUTOFF.minusSeconds(86400), 2, null));

        PredictionOutcome outcome = EvidenceWinRateModel.predict(race, history, CUTOFF);

        assertThat(outcome.status()).isEqualTo(PredictionStatus.READY);
        assertThat(outcome.probabilitySum()).isEqualByComparingTo("1.0000");
        assertThat(outcome.runners()).extracting(RunnerPrediction::probability).containsExactly(
                new BigDecimal("0.7311"), new BigDecimal("0.2689"));
        assertThat(outcome.runners().get(0).runnerEntryId()).isEqualTo(RUNNER_A);
        assertThat(outcome.runners().get(0).rank()).isEqualTo(1);
        assertThat(outcome.message()).contains("not guarantees");
    }

    @Test
    void missingSectionalIsNotScoredAsZero() {
        RaceToPredict race = new RaceToPredict(
                RACE_ID,
                CUTOFF,
                "AU",
                1200,
                null,
                null,
                null,
                null,
                "flat",
                List.of(runner(RUNNER_A, HORSE_A, false), runner(RUNNER_B, HORSE_B, false)));
        List<HistoricalStart> history = List.of(
                start(HORSE_A, CUTOFF.minusSeconds(172800), 1, new BigDecimal("10.000")),
                start(HORSE_A, CUTOFF.minusSeconds(200000), 2, null),
                start(HORSE_B, CUTOFF.minusSeconds(172800), 1, null),
                start(HORSE_B, CUTOFF.minusSeconds(200000), 2, null),
                start(UUID.randomUUID(), CUTOFF.minusSeconds(259200), 4, new BigDecimal("30.000")));

        PredictionOutcome outcome = EvidenceWinRateModel.predict(race, history, CUTOFF);

        Factor sectional = factor(outcome, RUNNER_B, "sectionalTime");
        assertThat(sectional.available()).isFalse();
        assertThat(sectional.value()).isNull();
        assertThat(sectional.detail()).contains("not treated as zero");
        assertThat(probability(outcome, RUNNER_A)).isGreaterThan(probability(outcome, RUNNER_B));
    }

    @Test
    void withdrawnRunnerIsExcludedAndTheRemainderStillSumsToOne() {
        RaceToPredict race = race(List.of(
                runner(RUNNER_A, HORSE_A, false),
                runner(RUNNER_B, HORSE_B, false),
                runner(RUNNER_C, UUID.randomUUID(), true)));
        List<HistoricalStart> history = List.of(
                start(HORSE_A, CUTOFF.minusSeconds(86400), 1, null),
                start(HORSE_B, CUTOFF.minusSeconds(86400), 3, null));

        PredictionOutcome outcome = EvidenceWinRateModel.predict(race, history, CUTOFF);

        assertThat(outcome.runners()).extracting(RunnerPrediction::runnerEntryId).containsExactly(RUNNER_A, RUNNER_B);
        assertThat(outcome.probabilitySum()).isEqualByComparingTo("1.0000");
    }

    @Test
    void futureResultDoesNotChangeTheProbability() {
        RaceToPredict race = race(List.of(runner(RUNNER_A, HORSE_A, false), runner(RUNNER_B, HORSE_B, false)));
        HistoricalStart pastA = start(HORSE_A, CUTOFF.minusSeconds(86400), 1, null);
        HistoricalStart pastB = start(HORSE_B, CUTOFF.minusSeconds(86400), 2, null);
        HistoricalStart futureWinForB = start(HORSE_B, CUTOFF.plusSeconds(3600), 1, null);

        PredictionOutcome withoutFuture = EvidenceWinRateModel.predict(race, List.of(pastA, pastB), CUTOFF);
        PredictionOutcome withFuture = EvidenceWinRateModel.predict(race, List.of(pastA, pastB, futureWinForB), CUTOFF);

        assertThat(probability(withFuture, RUNNER_B)).isEqualByComparingTo(probability(withoutFuture, RUNNER_B));
    }

    @Test
    void resultAtTheCutoffItselfIsNotUsed() {
        RaceToPredict race = race(List.of(runner(RUNNER_A, HORSE_A, false), runner(RUNNER_B, HORSE_B, false)));
        List<HistoricalStart> history = List.of(
                start(HORSE_A, CUTOFF, 1, null),
                start(HORSE_B, CUTOFF, 2, null));

        PredictionOutcome outcome = EvidenceWinRateModel.predict(race, history, CUTOFF);

        assertThat(outcome.status()).isEqualTo(PredictionStatus.INSUFFICIENT_DATA);
        assertThat(outcome.probabilitySum()).isNull();
    }

    @Test
    void countryWithoutStoredResultsIsInsufficient() {
        RaceToPredict race = new RaceToPredict(
                RACE_ID,
                CUTOFF,
                "IN",
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(runner(RUNNER_A, HORSE_A, false), runner(RUNNER_B, HORSE_B, false)));
        List<HistoricalStart> otherCountry = List.of(
                start(HORSE_A, CUTOFF.minusSeconds(86400), 1, null),
                start(HORSE_B, CUTOFF.minusSeconds(86400), 2, null));

        PredictionOutcome outcome = EvidenceWinRateModel.predict(race, otherCountry, CUTOFF);

        assertThat(outcome.status()).isEqualTo(PredictionStatus.INSUFFICIENT_DATA);
        assertThat(outcome.message()).contains("this country");
        assertThat(outcome.runners()).allSatisfy(runner -> assertThat(runner.probability()).isNull());
    }

    @Test
    void baselineIsEqualAndDoesNotUseHistory() {
        RaceToPredict race = race(List.of(runner(RUNNER_A, HORSE_A, false), runner(RUNNER_B, HORSE_B, false)));

        PredictionOutcome baseline = EqualProbabilityBaseline.predict(race, CUTOFF);

        assertThat(baseline.modelVersion()).isEqualTo(EqualProbabilityBaseline.VERSION);
        assertThat(baseline.runners()).extracting(RunnerPrediction::probability)
                .containsExactly(new BigDecimal("0.5000"), new BigDecimal("0.5000"));
    }

    private static RaceToPredict race(List<DeclaredRunner> runners) {
        return new RaceToPredict(RACE_ID, CUTOFF, "AU", null, null, null, null, null, "flat", runners);
    }

    private static DeclaredRunner runner(UUID runnerId, UUID horseId, boolean withdrawn) {
        return new DeclaredRunner(runnerId, horseId, null, null, null, null, withdrawn);
    }

    private static HistoricalStart start(UUID horseId, Instant ranAt, int position, BigDecimal sectional) {
        return new HistoricalStart(
                horseId,
                ranAt,
                "AU",
                1200,
                null,
                null,
                null,
                null,
                null,
                position,
                null,
                null,
                sectional,
                null,
                null);
    }

    private static Factor factor(PredictionOutcome outcome, UUID runnerId, String name) {
        return outcome.runners().stream()
                .filter(runner -> runner.runnerEntryId().equals(runnerId))
                .flatMap(runner -> runner.factors().stream())
                .filter(factor -> factor.name().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private static BigDecimal probability(PredictionOutcome outcome, UUID runnerId) {
        return outcome.runners().stream()
                .filter(runner -> runner.runnerEntryId().equals(runnerId))
                .map(RunnerPrediction::probability)
                .findFirst()
                .orElseThrow();
    }
}
