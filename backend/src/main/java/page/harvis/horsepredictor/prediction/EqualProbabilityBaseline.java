package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class EqualProbabilityBaseline {

    public static final String VERSION = "equal-probability-v1";

    private EqualProbabilityBaseline() {}

    public static PredictionOutcome predict(RaceToPredict race, Instant cutoff) {
        List<DeclaredRunner> eligible = eligible(race);
        if (eligible.size() < 2) {
            return new PredictionOutcome(
                    VERSION,
                    PredictionStatus.INSUFFICIENT_DATA,
                    "Fewer than two declared runners remain. " + CoverageNotes.DISCLAIMER,
                    cutoff,
                    null,
                    List.of());
        }
        List<BigDecimal> shares = ProbabilityMath.equalShares(eligible.size());
        List<RunnerPrediction> runners = new ArrayList<>();
        for (int i = 0; i < eligible.size(); i++) {
            runners.add(new RunnerPrediction(
                    eligible.get(i).runnerEntryId(),
                    shares.get(i),
                    null,
                    List.of(Factor.present(
                            "equalShare",
                            shares.get(i).doubleValue(),
                            "Baseline uses no historical evidence. Each declared runner receives an equal share."))));
        }
        runners = rank(runners);
        return new PredictionOutcome(
                VERSION,
                PredictionStatus.READY,
                "Equal-probability baseline. Historical form is not used. " + CoverageNotes.DISCLAIMER,
                cutoff,
                ProbabilityMath.sum(shares),
                runners);
    }

    static List<DeclaredRunner> eligible(RaceToPredict race) {
        return race.runners().stream()
                .filter(runner -> !runner.withdrawn())
                .sorted(Comparator.comparing(runner -> runner.runnerEntryId().toString()))
                .toList();
    }

    static List<RunnerPrediction> rank(List<RunnerPrediction> runners) {
        List<RunnerPrediction> ordered = runners.stream()
                .sorted(Comparator.comparing(RunnerPrediction::probability).reversed()
                        .thenComparing(runner -> runner.runnerEntryId().toString()))
                .toList();
        List<RunnerPrediction> ranked = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            RunnerPrediction runner = ordered.get(i);
            ranked.add(new RunnerPrediction(runner.runnerEntryId(), runner.probability(), i + 1, runner.factors()));
        }
        return List.copyOf(ranked);
    }
}
