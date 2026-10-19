package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import page.harvis.horsepredictor.api.AccuracySummaryResponse;
import page.harvis.horsepredictor.api.FactorResponse;
import page.harvis.horsepredictor.api.PredictionResponse;
import page.harvis.horsepredictor.api.RunnerPredictionResponse;
import page.harvis.horsepredictor.racing.OddsQuote;
import page.harvis.horsepredictor.racing.OddsQuoteRepository;
import page.harvis.horsepredictor.racing.Race;
import page.harvis.horsepredictor.racing.RaceRepository;
import page.harvis.horsepredictor.racing.RunnerEntry;
import page.harvis.horsepredictor.racing.RunnerResult;
import page.harvis.horsepredictor.racing.StoredPrediction;
import page.harvis.horsepredictor.racing.StoredPredictionFactor;
import page.harvis.horsepredictor.racing.StoredPredictionRepository;
import page.harvis.horsepredictor.racing.StoredPredictionRunner;

@Service
@Profile("!nodb")
public class PredictionApplicationService {

    private final RaceRepository races;
    private final OddsQuoteRepository quotes;
    private final StoredPredictionRepository predictions;
    private final Clock clock;

    public PredictionApplicationService(
            RaceRepository races, OddsQuoteRepository quotes, StoredPredictionRepository predictions, Clock clock) {
        this.races = races;
        this.quotes = quotes;
        this.predictions = predictions;
        this.clock = clock;
    }

    @Transactional
    public PredictionResponse predictionFor(UUID raceId) {
        Race race = races.findWithEntriesById(raceId).orElseThrow(() -> new RaceNotFoundException(raceId));
        String fingerprint = fingerprint(race);
        return predictions
                .findFirstByRace_IdAndModelVersionOrderByCreatedAtDesc(raceId, EvidenceWinRateModel.VERSION)
                .filter(existing -> fingerprint.equals(existing.getDeclarationFingerprint()))
                .filter(existing -> !existing.getFeatureCutoff().isAfter(race.getOffTime()))
                .map(existing -> predictions.findWithRunnersById(existing.getId()).orElse(existing))
                .map(this::loadFactors)
                .map(this::toResponse)
                .orElseGet(() -> toResponse(save(race, fingerprint)));
    }

    @Transactional(readOnly = true)
    public PredictionResponse predictionById(UUID predictionId) {
        StoredPrediction prediction = predictions
                .findWithRunnersById(predictionId)
                .map(this::loadFactors)
                .orElseThrow(() -> new PredictionNotFoundException(predictionId));
        return toResponse(prediction);
    }

    @Transactional(readOnly = true)
    public AccuracySummaryResponse accuracy() {
        List<Race> storedRaces = races.findAllForBacktest();
        Map<UUID, List<OddsQuoteView>> quotesByRace = quotes.findAllWithRaces().stream()
                .collect(Collectors.groupingBy(
                        quote -> quote.getRunnerEntry().getRace().getId(),
                        Collectors.mapping(PredictionApplicationService::quoteView, Collectors.toList())));
        List<CompletedRace> completed = storedRaces.stream()
                .map(race -> toCompleted(race, quotesByRace.getOrDefault(race.getId(), List.of())))
                .toList();
        BacktestReport report = BacktestEngine.run(completed);
        return new AccuracySummaryResponse(
                report.status(),
                report.racesSupplied(),
                report.racesScored(),
                report.evidence(),
                report.baseline(),
                report.oddsBenchmark(),
                report.byCountry(),
                report.byDistance(),
                report.byRaceType(),
                report.calibration(),
                report.limitations());
    }

    private StoredPrediction save(Race race, String fingerprint) {
        List<Race> allRaces = races.findAllForBacktest();
        PredictionOutcome outcome =
                EvidenceWinRateModel.predict(toCard(race), history(allRaces), race.getOffTime());
        Map<UUID, RunnerEntry> entries =
                race.getEntries().stream().collect(Collectors.toMap(RunnerEntry::getId, Function.identity()));
        StoredPrediction prediction = new StoredPrediction(
                UUID.randomUUID(),
                race,
                clock.instant(),
                outcome.modelVersion(),
                outcome.featureCutoff(),
                outcome.status().name(),
                fingerprint,
                trim(outcome.message(), 1000));
        for (RunnerPrediction runner : outcome.runners()) {
            RunnerEntry entry = entries.get(runner.runnerEntryId());
            if (entry == null) {
                continue;
            }
            StoredPredictionRunner storedRunner =
                    new StoredPredictionRunner(UUID.randomUUID(), entry, runner.probability(), runner.rank());
            for (Factor factor : runner.factors()) {
                storedRunner.addFactor(new StoredPredictionFactor(
                        UUID.randomUUID(), factor.name(), factor.available(), factor.value(), factor.detail()));
            }
            prediction.addRunner(storedRunner);
        }
        return predictions.save(prediction);
    }

    private StoredPrediction loadFactors(StoredPrediction prediction) {
        prediction.getRunners().forEach(runner -> runner.getFactors().size());
        return prediction;
    }

    private PredictionResponse toResponse(StoredPrediction prediction) {
        List<RunnerPredictionResponse> runners = prediction.getRunners().stream()
                .sorted(Comparator.comparing(runner -> runner.getRankPosition() == null ? Integer.MAX_VALUE : runner.getRankPosition()))
                .map(runner -> new RunnerPredictionResponse(
                        runner.getRunnerEntry().getId(),
                        runner.getProbability(),
                        runner.getRankPosition(),
                        runner.getFactors().stream()
                                .map(factor -> new FactorResponse(
                                        factor.getFactorName(),
                                        factor.isAvailable(),
                                        factor.getNumericValue(),
                                        factor.getDetail()))
                                .toList()))
                .toList();
        boolean complete = !runners.isEmpty() && runners.stream().allMatch(runner -> runner.probability() != null);
        BigDecimal sum = complete
                ? runners.stream().map(RunnerPredictionResponse::probability).reduce(BigDecimal.ZERO, BigDecimal::add)
                : null;
        return new PredictionResponse(
                prediction.getId(),
                prediction.getRace().getId(),
                prediction.getStatus(),
                prediction.getModelVersion(),
                prediction.getCreatedAt(),
                prediction.getFeatureCutoff(),
                prediction.getMessage(),
                sum,
                runners);
    }

    private static CompletedRace toCompleted(Race race, List<OddsQuoteView> raceQuotes) {
        Map<UUID, Integer> positions = race.getEntries().stream()
                .filter(entry -> entry.getResult() != null && entry.getResult().getFinishingPosition() != null)
                .collect(Collectors.toMap(RunnerEntry::getId, entry -> entry.getResult().getFinishingPosition()));
        return new CompletedRace(toCard(race), positions, raceQuotes);
    }

    private static RaceToPredict toCard(Race race) {
        List<DeclaredRunner> runners = race.getEntries().stream()
                .map(entry -> new DeclaredRunner(
                        entry.getId(),
                        entry.getHorse().getId(),
                        entry.getJockey() == null ? null : entry.getJockey().getId(),
                        entry.getTrainer() == null ? null : entry.getTrainer().getId(),
                        entry.getBarrier(),
                        entry.getCarriedWeightKg(),
                        entry.isWithdrawn()))
                .toList();
        return new RaceToPredict(
                race.getId(),
                race.getOffTime(),
                race.getCountryCode(),
                race.getDistanceMetres(),
                race.getSurface(),
                race.getRaceClass(),
                race.getGoing(),
                race.getCourseName(),
                race.getRaceType(),
                runners);
    }

    private static List<HistoricalStart> history(List<Race> races) {
        List<HistoricalStart> starts = new ArrayList<>();
        for (Race race : races) {
            for (RunnerEntry entry : race.getEntries()) {
                if (entry.isWithdrawn() || entry.getResult() == null) {
                    continue;
                }
                RunnerResult result = entry.getResult();
                starts.add(new HistoricalStart(
                        entry.getHorse().getId(),
                        race.getOffTime(),
                        race.getCountryCode(),
                        race.getDistanceMetres(),
                        race.getSurface(),
                        race.getRaceClass(),
                        race.getGoing(),
                        race.getCourseName(),
                        entry.getBarrier(),
                        result.getFinishingPosition(),
                        result.getMarginLengths(),
                        result.getFinishTimeSeconds(),
                        result.getSectionalTimeSeconds(),
                        entry.getJockey() == null ? null : entry.getJockey().getId(),
                        entry.getTrainer() == null ? null : entry.getTrainer().getId()));
            }
        }
        return starts;
    }

    private static OddsQuoteView quoteView(OddsQuote quote) {
        return new OddsQuoteView(quote.getRunnerEntry().getId(), quote.getQuotedAt(), quote.getDecimalOdds());
    }

    static String fingerprint(Race race) {
        String raw = race.getEntries().stream()
                .sorted(Comparator.comparing(entry -> entry.getId().toString()))
                .map(entry -> entry.getId()
                        + "|" + entry.isWithdrawn()
                        + "|" + entry.getBarrier()
                        + "|" + entry.getCarriedWeightKg()
                        + "|" + (entry.getJockey() == null ? "" : entry.getJockey().getId())
                        + "|" + (entry.getTrainer() == null ? "" : entry.getTrainer().getId()))
                .collect(Collectors.joining("\n"));
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private static String trim(String value, int limit) {
        if (value == null) {
            return "";
        }
        return value.length() <= limit ? value : value.substring(0, limit);
    }
}
