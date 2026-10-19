package page.harvis.horsepredictor.prediction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import page.harvis.horsepredictor.api.AccuracySummaryResponse;
import page.harvis.horsepredictor.api.PredictionResponse;
import page.harvis.horsepredictor.racing.Horse;
import page.harvis.horsepredictor.racing.OddsQuoteRepository;
import page.harvis.horsepredictor.racing.Race;
import page.harvis.horsepredictor.racing.RaceRepository;
import page.harvis.horsepredictor.racing.RunnerEntry;
import page.harvis.horsepredictor.racing.StoredPrediction;
import page.harvis.horsepredictor.racing.StoredPredictionRepository;

@ExtendWith(MockitoExtension.class)
class PredictionApplicationServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");
    private static final UUID RACE_ID = UUID.fromString("00000000-0000-0000-0000-000000000201");

    @Mock
    private RaceRepository races;

    @Mock
    private OddsQuoteRepository quotes;

    @Mock
    private StoredPredictionRepository predictions;

    private PredictionApplicationService service;
    private Race race;

    @BeforeEach
    void setUp() {
        service = new PredictionApplicationService(races, quotes, predictions, Clock.fixed(NOW, ZoneOffset.UTC));
        race = new Race(RACE_ID, null, NOW, "AU", null, null, null, null, "flat", null);
        race.addEntry(entry(UUID.fromString("00000000-0000-0000-0000-000000000211"), false));
        race.addEntry(entry(UUID.fromString("00000000-0000-0000-0000-000000000212"), false));
    }

    @Test
    void unknownRaceReturnsNotFound() {
        when(races.findWithEntriesById(RACE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.predictionFor(RACE_ID)).isInstanceOf(RaceNotFoundException.class);
    }

    @Test
    void firstRequestStoresAnInsufficientPredictionAndTheNextRequestKeepsThatRow() {
        when(races.findWithEntriesById(RACE_ID)).thenReturn(Optional.of(race));
        when(races.findAllForBacktest()).thenReturn(List.of(race));
        when(predictions.findFirstByRace_IdAndModelVersionOrderByCreatedAtDesc(RACE_ID, EvidenceWinRateModel.VERSION))
                .thenReturn(Optional.empty());
        when(predictions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PredictionResponse created = service.predictionFor(RACE_ID);

        assertThat(created.status()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(created.probabilitySum()).isNull();
        assertThat(created.runners()).hasSize(2);
        assertThat(created.runners()).allSatisfy(runner -> assertThat(runner.probability()).isNull());
        assertThat(created.message()).contains("not guarantees");

        StoredPrediction stored = captured();
        when(predictions.findFirstByRace_IdAndModelVersionOrderByCreatedAtDesc(RACE_ID, EvidenceWinRateModel.VERSION))
                .thenReturn(Optional.of(stored));
        when(predictions.findWithRunnersById(stored.getId())).thenReturn(Optional.of(stored));

        PredictionResponse repeated = service.predictionFor(RACE_ID);

        assertThat(repeated.predictionId()).isEqualTo(created.predictionId());
        verify(predictions, times(1)).save(any());
    }

    @Test
    void aChangedDeclarationStoresASecondPrediction() {
        when(races.findWithEntriesById(RACE_ID)).thenReturn(Optional.of(race));
        when(races.findAllForBacktest()).thenReturn(List.of(race));
        when(predictions.findFirstByRace_IdAndModelVersionOrderByCreatedAtDesc(RACE_ID, EvidenceWinRateModel.VERSION))
                .thenReturn(Optional.empty());
        when(predictions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.predictionFor(RACE_ID);
        StoredPrediction first = captured();

        race.getEntries().get(1).markWithdrawn();
        when(predictions.findFirstByRace_IdAndModelVersionOrderByCreatedAtDesc(RACE_ID, EvidenceWinRateModel.VERSION))
                .thenReturn(Optional.of(first));

        PredictionResponse updated = service.predictionFor(RACE_ID);

        assertThat(updated.predictionId()).isNotEqualTo(first.getId());
        assertThat(updated.status()).isEqualTo("INSUFFICIENT_DATA");
        verify(predictions, times(2)).save(any());
    }

    @Test
    void accuracySummaryOnAnEmptyDatabaseDoesNotClaimAScore() {
        when(races.findAllForBacktest()).thenReturn(List.of());
        when(quotes.findAllWithRaces()).thenReturn(List.of());

        AccuracySummaryResponse summary = service.accuracy();

        assertThat(summary.status()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(summary.racesScored()).isZero();
        assertThat(summary.evidence().logLoss()).isNull();
        assertThat(summary.baseline().brierScore()).isNull();
        assertThat(summary.oddsBenchmark().status()).isEqualTo("UNAVAILABLE");
        assertThat(summary.limitations()).anyMatch(note -> note.contains("Demonstration"));
    }

    private StoredPrediction captured() {
        ArgumentCaptor<StoredPrediction> captor = ArgumentCaptor.forClass(StoredPrediction.class);
        verify(predictions, times(1)).save(captor.capture());
        return captor.getValue();
    }

    private static RunnerEntry entry(UUID id, boolean withdrawn) {
        return new RunnerEntry(id, null, new Horse(UUID.randomUUID(), "Test horse"), null, null, null, null, null, withdrawn);
    }
}
