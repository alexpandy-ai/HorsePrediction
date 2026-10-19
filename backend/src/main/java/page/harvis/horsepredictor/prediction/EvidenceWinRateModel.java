package page.harvis.horsepredictor.prediction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class EvidenceWinRateModel {

    public static final String VERSION = "evidence-winrate-v1";

    static final Map<String, Double> WEIGHTS = weights();

    private EvidenceWinRateModel() {}

    public static PredictionOutcome predict(RaceToPredict race, List<HistoricalStart> history, Instant cutoff) {
        List<DeclaredRunner> eligible = EqualProbabilityBaseline.eligible(race);
        if (eligible.size() < 2) {
            return insufficient(cutoff, "Fewer than two declared runners remain.");
        }
        List<HistoricalStart> prior = history.stream()
                .filter(start -> start.ranAt().isBefore(cutoff))
                .toList();
        boolean countryHasHistory = prior.stream()
                .anyMatch(start -> start.countryCode() != null && start.countryCode().equals(race.countryCode()));
        Map<UUID, List<Factor>> factorsByRunner = new LinkedHashMap<>();
        Map<UUID, Double> strengthByRunner = new LinkedHashMap<>();
        for (DeclaredRunner runner : eligible) {
            List<Factor> factors = FeaturePipeline.features(race, runner, prior, cutoff);
            factorsByRunner.put(runner.runnerEntryId(), factors);
            strength(factors).ifPresent(strength -> strengthByRunner.put(runner.runnerEntryId(), strength));
        }
        if (!countryHasHistory) {
            return insufficient(
                    cutoff,
                    runnersWithoutProbabilities(factorsByRunner),
                    "No official results are stored for this country before the cutoff.");
        }
        if (strengthByRunner.size() < 2) {
            return insufficient(
                    cutoff,
                    runnersWithoutProbabilities(factorsByRunner),
                    "Fewer than two declared runners have a completed start before the cutoff.");
        }
        double fieldAverage = strengthByRunner.values().stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        List<Double> scores = new ArrayList<>();
        List<List<Factor>> factorRows = new ArrayList<>();
        List<DeclaredRunner> order = new ArrayList<>();
        for (DeclaredRunner runner : eligible) {
            List<Factor> factors = new ArrayList<>(factorsByRunner.get(runner.runnerEntryId()));
            if (!strengthByRunner.containsKey(runner.runnerEntryId())) {
                factors.add(Factor.present(
                        "fieldAverage",
                        fieldAverage,
                        "No personal history before the cutoff. Assigned the average strength of runners who have history. This is not a zero."));
                scores.add(fieldAverage);
            } else {
                scores.add(strengthByRunner.get(runner.runnerEntryId()));
            }
            factorRows.add(List.copyOf(factors));
            order.add(runner);
        }
        List<java.math.BigDecimal> probabilities = ProbabilityMath.softmax(scores);
        List<RunnerPrediction> runners = new ArrayList<>();
        for (int i = 0; i < order.size(); i++) {
            runners.add(new RunnerPrediction(order.get(i).runnerEntryId(), probabilities.get(i), null, factorRows.get(i)));
        }
        runners = EqualProbabilityBaseline.rank(runners);
        return new PredictionOutcome(
                VERSION,
                PredictionStatus.READY,
                "Evidence model using only factors recorded before the cutoff. Fixed weights, not fitted on this sample. "
                        + CoverageNotes.DISCLAIMER,
                cutoff,
                ProbabilityMath.sum(probabilities),
                runners);
    }

    private static java.util.OptionalDouble strength(List<Factor> factors) {
        double weighted = 0;
        double weightSum = 0;
        boolean historical = false;
        for (Factor factor : factors) {
            Double weight = WEIGHTS.get(factor.name());
            if (!factor.available() || factor.value() == null || weight == null) {
                continue;
            }
            if (!"carriedWeight".equals(factor.name())) {
                historical = true;
            }
            weighted += weight * factor.value();
            weightSum += weight;
        }
        if (!historical || weightSum == 0) {
            return java.util.OptionalDouble.empty();
        }
        return java.util.OptionalDouble.of(weighted / weightSum);
    }

    private static PredictionOutcome insufficient(Instant cutoff, String reason) {
        return insufficient(cutoff, List.of(), reason);
    }

    private static PredictionOutcome insufficient(Instant cutoff, List<RunnerPrediction> runners, String reason) {
        return new PredictionOutcome(
                VERSION,
                PredictionStatus.INSUFFICIENT_DATA,
                reason + " " + CoverageNotes.DISCLAIMER,
                cutoff,
                null,
                runners);
    }

    private static List<RunnerPrediction> runnersWithoutProbabilities(Map<UUID, List<Factor>> factorsByRunner) {
        return factorsByRunner.entrySet().stream()
                .map(entry -> new RunnerPrediction(entry.getKey(), null, null, entry.getValue()))
                .toList();
    }

    private static Map<String, Double> weights() {
        Map<String, Double> weights = new LinkedHashMap<>();
        weights.put("priorWinRate", 0.30);
        weights.put("distanceWinRate", 0.15);
        weights.put("courseWinRate", 0.10);
        weights.put("surfaceWinRate", 0.08);
        weights.put("classWinRate", 0.08);
        weights.put("goingWinRate", 0.05);
        weights.put("margin", 0.07);
        weights.put("finishTime", 0.05);
        weights.put("sectionalTime", 0.04);
        weights.put("carriedWeight", 0.03);
        weights.put("barrier", 0.03);
        weights.put("restDays", 0.01);
        weights.put("jockeyStrikeRate", 0.005);
        weights.put("trainerStrikeRate", 0.005);
        return Map.copyOf(weights);
    }
}
