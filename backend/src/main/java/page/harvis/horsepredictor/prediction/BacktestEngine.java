package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BacktestEngine {

    private static final double LOG_LOSS_FLOOR = 1e-6;

    private BacktestEngine() {}

    public static void requireSeparated(Instant trainingEnd, Instant evaluationStart) {
        if (trainingEnd == null || evaluationStart == null || !evaluationStart.isAfter(trainingEnd)) {
            throw new OverlappingWindowException(trainingEnd, evaluationStart);
        }
    }

    public static BacktestReport run(List<CompletedRace> races) {
        return run(races, null);
    }

    public static BacktestReport run(List<CompletedRace> races, Instant evaluationStart) {
        List<CompletedRace> ordered = races.stream()
                .sorted(Comparator.comparing(race -> race.race().offTime()))
                .toList();
        List<HistoricalStart> history = flatten(ordered);
        List<ScoredRace> scored = new ArrayList<>();
        List<Double> marketLosses = new ArrayList<>();
        int ignoredFuture = 0;
        int ignoredUntimestamped = 0;

        for (CompletedRace completed : ordered) {
            Instant cutoff = completed.race().offTime();
            if (evaluationStart != null && cutoff.isBefore(evaluationStart)) {
                continue;
            }
            PredictionOutcome evidence = EvidenceWinRateModel.predict(completed.race(), history, cutoff);
            PredictionOutcome baseline = EqualProbabilityBaseline.predict(completed.race(), cutoff);
            UUID winner = uniqueWinner(completed);
            if (winner != null && evidence.status() == PredictionStatus.READY && baseline.status() == PredictionStatus.READY) {
                scored.add(new ScoredRace(completed.race(), winner, evidence, baseline));
            }
            QuoteUse quotes = usableQuotes(completed, cutoff);
            ignoredFuture += quotes.ignoredFuture();
            ignoredUntimestamped += quotes.ignoredUntimestamped();
            if (winner != null
                    && evidence.status() == PredictionStatus.READY
                    && quotes.latestByRunner().size() == EqualProbabilityBaseline.eligible(completed.race()).size()) {
                marketLosses.add(marketLogLoss(quotes.latestByRunner(), winner, completed));
            }
        }

        List<String> limitations = new ArrayList<>(CoverageNotes.ALWAYS);
        if (scored.isEmpty()) {
            limitations.add(
                    "No official historical results produced a scored race, so strike rate, log loss, Brier score, and calibration were not calculated.");
            return new BacktestReport(
                    "INSUFFICIENT_DATA",
                    races.size(),
                    0,
                    ModelScore.empty(EvidenceWinRateModel.VERSION),
                    ModelScore.empty(EqualProbabilityBaseline.VERSION),
                    new OddsBenchmark(
                            "UNAVAILABLE", 0, null, ignoredFuture, ignoredUntimestamped),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.copyOf(limitations));
        }
        if (scored.size() < 30) {
            limitations.add("Fewer than 30 scored races. These figures do not support an accuracy or profitability claim.");
        }
        limitations.add("Slice totals below 30 races are descriptive only.");
        OddsBenchmark odds = marketLosses.isEmpty()
                ? new OddsBenchmark("UNAVAILABLE", 0, null, ignoredFuture, ignoredUntimestamped)
                : new OddsBenchmark(
                        "CALCULATED",
                        marketLosses.size(),
                        average(marketLosses),
                        ignoredFuture,
                        ignoredUntimestamped);
        if (marketLosses.isEmpty()) {
            limitations.add("No timestamped pre-race odds covered a scored field, so there is no odds benchmark.");
        }
        return new BacktestReport(
                "CALCULATED",
                races.size(),
                scored.size(),
                metrics(EvidenceWinRateModel.VERSION, scored, true),
                metrics(EqualProbabilityBaseline.VERSION, scored, false),
                odds,
                slices(scored, race -> race.countryCode() == null ? "country unavailable" : race.countryCode()),
                slices(scored, race -> race.distanceMetres() == null ? "distance unavailable" : race.distanceMetres() + "m"),
                slices(scored, race -> race.raceType() == null ? "race type unavailable" : race.raceType()),
                calibration(scored),
                List.copyOf(limitations));
    }

    private static ModelScore metrics(String modelVersion, List<ScoredRace> scored, boolean evidence) {
        int hits = 0;
        List<Double> losses = new ArrayList<>();
        List<Double> briers = new ArrayList<>();
        for (ScoredRace race : scored) {
            PredictionOutcome outcome = evidence ? race.evidence() : race.baseline();
            RunnerPrediction top = outcome.runners().stream()
                    .filter(runner -> runner.rank() != null && runner.rank() == 1)
                    .findFirst()
                    .orElseThrow();
            if (top.runnerEntryId().equals(race.winner())) {
                hits++;
            }
            losses.add(logLoss(probabilityOf(outcome, race.winner())));
            briers.add(brier(outcome, race.winner()));
        }
        return new ModelScore(
                modelVersion,
                scored.size(),
                ratio(hits, scored.size()),
                average(losses),
                average(briers));
    }

    private static List<SliceScore> slices(List<ScoredRace> scored, java.util.function.Function<RaceToPredict, String> key) {
        Map<String, List<ScoredRace>> groups = new HashMap<>();
        for (ScoredRace race : scored) {
            groups.computeIfAbsent(key.apply(race.race()), ignored -> new ArrayList<>()).add(race);
        }
        return groups.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    ModelScore score = metrics(EvidenceWinRateModel.VERSION, entry.getValue(), true);
                    return new SliceScore(
                            entry.getKey(),
                            score.raceCount(),
                            score.topRankedStrikeRate(),
                            score.logLoss(),
                            score.brierScore());
                })
                .toList();
    }

    private static List<CalibrationBin> calibration(List<ScoredRace> scored) {
        int[] counts = new int[10];
        double[] predicted = new double[10];
        int[] wins = new int[10];
        for (ScoredRace race : scored) {
            for (RunnerPrediction runner : race.evidence().runners()) {
                if (runner.probability() == null) {
                    continue;
                }
                double probability = runner.probability().doubleValue();
                int bin = Math.min(9, (int) Math.floor(probability * 10));
                counts[bin]++;
                predicted[bin] += probability;
                if (runner.runnerEntryId().equals(race.winner())) {
                    wins[bin]++;
                }
            }
        }
        List<CalibrationBin> bins = new ArrayList<>();
        for (int i = 0; i < counts.length; i++) {
            if (counts[i] == 0) {
                continue;
            }
            bins.add(new CalibrationBin(
                    i / 10.0 + "-" + ((i + 1) / 10.0),
                    counts[i],
                    BigDecimal.valueOf(predicted[i] / counts[i]).setScale(4, RoundingMode.HALF_UP),
                    ratio(wins[i], counts[i])));
        }
        return List.copyOf(bins);
    }

    private static QuoteUse usableQuotes(CompletedRace completed, Instant cutoff) {
        int future = 0;
        int untimestamped = 0;
        Map<UUID, OddsQuoteView> latest = new HashMap<>();
        for (OddsQuoteView quote : completed.quotes()) {
            if (quote.quotedAt() == null) {
                untimestamped++;
                continue;
            }
            if (quote.quotedAt().isAfter(cutoff)) {
                future++;
                continue;
            }
            if (quote.decimalOdds() == null || quote.decimalOdds().doubleValue() <= 1.0) {
                continue;
            }
            OddsQuoteView current = latest.get(quote.runnerEntryId());
            if (current == null || quote.quotedAt().isAfter(current.quotedAt())) {
                latest.put(quote.runnerEntryId(), quote);
            }
        }
        return new QuoteUse(future, untimestamped, latest);
    }

    private static double marketLogLoss(Map<UUID, OddsQuoteView> latest, UUID winner, CompletedRace completed) {
        List<DeclaredRunner> eligible = EqualProbabilityBaseline.eligible(completed.race());
        double weightSum = 0;
        Map<UUID, Double> implied = new HashMap<>();
        for (DeclaredRunner runner : eligible) {
            double weight = 1.0 / latest.get(runner.runnerEntryId()).decimalOdds().doubleValue();
            implied.put(runner.runnerEntryId(), weight);
            weightSum += weight;
        }
        double probability = implied.get(winner) / weightSum;
        return logLoss(BigDecimal.valueOf(probability));
    }

    private static UUID uniqueWinner(CompletedRace completed) {
        UUID winner = null;
        for (Map.Entry<UUID, Integer> entry : completed.finishingPositionByRunner().entrySet()) {
            if (entry.getValue() != null && entry.getValue() == 1) {
                if (winner != null) {
                    return null;
                }
                winner = entry.getKey();
            }
        }
        return winner;
    }

    private static BigDecimal probabilityOf(PredictionOutcome outcome, UUID winner) {
        return outcome.runners().stream()
                .filter(runner -> runner.runnerEntryId().equals(winner))
                .map(RunnerPrediction::probability)
                .findFirst()
                .orElseThrow();
    }

    private static double logLoss(BigDecimal probability) {
        double value = probability.doubleValue();
        double clipped = Math.min(1 - LOG_LOSS_FLOOR, Math.max(LOG_LOSS_FLOOR, value));
        return -Math.log(clipped);
    }

    private static double brier(PredictionOutcome outcome, UUID winner) {
        double total = 0;
        for (RunnerPrediction runner : outcome.runners()) {
            double expected = runner.runnerEntryId().equals(winner) ? 1 : 0;
            double difference = runner.probability().doubleValue() - expected;
            total += difference * difference;
        }
        return total;
    }

    private static BigDecimal average(List<Double> values) {
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        return BigDecimal.valueOf(mean).setScale(6, RoundingMode.HALF_UP);
    }

    private static BigDecimal ratio(int numerator, int denominator) {
        return BigDecimal.valueOf((double) numerator / denominator).setScale(4, RoundingMode.HALF_UP);
    }

    private static List<HistoricalStart> flatten(List<CompletedRace> races) {
        List<HistoricalStart> starts = new ArrayList<>();
        for (CompletedRace completed : races) {
            RaceToPredict race = completed.race();
            for (DeclaredRunner runner : race.runners()) {
                if (runner.withdrawn()) {
                    continue;
                }
                Integer position = completed.finishingPositionByRunner().get(runner.runnerEntryId());
                if (position == null) {
                    continue;
                }
                starts.add(new HistoricalStart(
                        runner.horseId(),
                        race.offTime(),
                        race.countryCode(),
                        race.distanceMetres(),
                        race.surface(),
                        race.raceClass(),
                        race.going(),
                        race.courseName(),
                        runner.barrier(),
                        position,
                        null,
                        null,
                        null,
                        runner.jockeyId(),
                        runner.trainerId()));
            }
        }
        return List.copyOf(starts);
    }

    private record ScoredRace(RaceToPredict race, UUID winner, PredictionOutcome evidence, PredictionOutcome baseline) {}

    private record QuoteUse(int ignoredFuture, int ignoredUntimestamped, Map<UUID, OddsQuoteView> latestByRunner) {}
}
