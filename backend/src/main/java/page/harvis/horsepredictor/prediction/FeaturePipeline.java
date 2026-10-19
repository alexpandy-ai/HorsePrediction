package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class FeaturePipeline {

    static final int MIN_BARRIER_STARTS = 5;
    static final int MIN_JOCKEY_RIDES = 20;
    static final int MIN_TRAINER_RUNNERS = 20;
    static final int MIN_REST_SAMPLES = 3;

    private FeaturePipeline() {}

    public static List<Factor> features(
            RaceToPredict race, DeclaredRunner runner, List<HistoricalStart> historyBeforeCutoff, Instant cutoff) {
        List<HistoricalStart> prior = historyBeforeCutoff.stream()
                .filter(start -> start.ranAt().isBefore(cutoff))
                .toList();
        List<HistoricalStart> horseStarts =
                prior.stream().filter(start -> start.horseId().equals(runner.horseId())).toList();
        List<HistoricalStart> completed =
                horseStarts.stream().filter(HistoricalStart::completed).toList();

        List<Factor> factors = new ArrayList<>();
        factors.add(winRate("priorWinRate", completed, "No completed start before the cutoff."));
        factors.add(scopedWinRate(
                "distanceWinRate",
                completed,
                start -> Objects.equals(start.distanceMetres(), race.distanceMetres()),
                race.distanceMetres() == null
                        ? "Race distance is not recorded, so distance form is unused."
                        : "No completed start at this distance before the cutoff."));
        factors.add(scopedWinRate(
                "courseWinRate",
                completed,
                start -> sameText(start.courseName(), race.courseName()),
                race.courseName() == null
                        ? "Course is not recorded, so course form is unused."
                        : "No completed start at this course before the cutoff."));
        factors.add(scopedWinRate(
                "surfaceWinRate",
                completed,
                start -> sameText(start.surface(), race.surface()),
                race.surface() == null
                        ? "Surface is not recorded, so surface form is unused."
                        : "No completed start on this surface before the cutoff."));
        factors.add(scopedWinRate(
                "classWinRate",
                completed,
                start -> sameText(start.raceClass(), race.raceClass()),
                race.raceClass() == null
                        ? "Race class is not recorded, so class form is unused."
                        : "No completed start in this class before the cutoff."));
        factors.add(scopedWinRate(
                "goingWinRate",
                completed,
                start -> sameText(start.going(), race.going()),
                race.going() == null
                        ? "Going is not recorded, so going form is unused."
                        : "No completed start on this going before the cutoff."));
        factors.add(margin(completed));
        factors.add(timeScore("finishTime", race, runner, prior, false));
        factors.add(timeScore("sectionalTime", race, runner, prior, true));
        factors.add(weight(race, runner));
        factors.add(barrier(race, runner, prior));
        factors.add(rest(completed, cutoff));
        factors.add(personRate("jockeyStrikeRate", runner.jockeyId(), prior, true));
        factors.add(personRate("trainerStrikeRate", runner.trainerId(), prior, false));
        return List.copyOf(factors);
    }

    private static Factor winRate(String name, List<HistoricalStart> completed, String missingDetail) {
        if (completed.isEmpty()) {
            return Factor.missing(name, missingDetail);
        }
        long wins = completed.stream().filter(start -> start.finishingPosition() == 1).count();
        return Factor.present(
                name,
                (double) wins / completed.size(),
                wins + " wins from " + completed.size() + " completed starts before the cutoff.");
    }

    private static Factor scopedWinRate(
            String name, List<HistoricalStart> completed, java.util.function.Predicate<HistoricalStart> scope, String missingDetail) {
        List<HistoricalStart> matched = completed.stream().filter(scope).toList();
        if (matched.isEmpty()) {
            return Factor.missing(name, missingDetail);
        }
        long wins = matched.stream().filter(start -> start.finishingPosition() == 1).count();
        return Factor.present(
                name, (double) wins / matched.size(), wins + " wins from " + matched.size() + " matching starts before the cutoff.");
    }

    private static Factor margin(List<HistoricalStart> completed) {
        List<BigDecimal> margins = completed.stream()
                .map(HistoricalStart::marginLengths)
                .filter(Objects::nonNull)
                .toList();
        if (margins.isEmpty()) {
            return Factor.missing("margin", "No margins are recorded. A missing margin is not treated as zero.");
        }
        double average = margins.stream().mapToDouble(BigDecimal::doubleValue).average().orElseThrow();
        return Factor.present("margin", 1.0 / (1.0 + average), "Average beaten margin is " + average + " lengths.");
    }

    private static Factor timeScore(
            String name, RaceToPredict race, DeclaredRunner runner, List<HistoricalStart> prior, boolean sectional) {
        if (race.distanceMetres() == null) {
            return Factor.missing(name, "Race distance is not recorded, so time is not compared. Missing time is not treated as zero.");
        }
        List<BigDecimal> reference = prior.stream()
                .filter(start -> Objects.equals(start.distanceMetres(), race.distanceMetres()))
                .map(start -> sectional ? start.sectionalTimeSeconds() : start.finishTimeSeconds())
                .filter(Objects::nonNull)
                .toList();
        List<BigDecimal> own = prior.stream()
                .filter(start -> start.horseId().equals(runner.horseId()))
                .filter(start -> Objects.equals(start.distanceMetres(), race.distanceMetres()))
                .map(start -> sectional ? start.sectionalTimeSeconds() : start.finishTimeSeconds())
                .filter(Objects::nonNull)
                .toList();
        if (reference.isEmpty() || own.isEmpty()) {
            return Factor.missing(
                    name,
                    sectional
                            ? "No sectional time is available at this distance. A missing sectional is not treated as zero."
                            : "No finish time is available at this distance. A missing time is not treated as zero.");
        }
        double referenceAverage = reference.stream().mapToDouble(BigDecimal::doubleValue).average().orElseThrow();
        double ownAverage = own.stream().mapToDouble(BigDecimal::doubleValue).average().orElseThrow();
        if (referenceAverage <= 0 || ownAverage <= 0) {
            return Factor.missing(name, "Stored time is not a positive duration, so it is unused.");
        }
        return Factor.present(name, referenceAverage / (referenceAverage + ownAverage), "Compared only with times at this distance.");
    }

    private static Factor weight(RaceToPredict race, DeclaredRunner runner) {
        if (runner.carriedWeightKg() == null) {
            return Factor.missing("carriedWeight", "Carried weight was not supplied and is not treated as zero.");
        }
        List<BigDecimal> declared = race.runners().stream()
                .filter(entry -> !entry.withdrawn())
                .map(DeclaredRunner::carriedWeightKg)
                .filter(Objects::nonNull)
                .toList();
        if (declared.size() < 2) {
            return Factor.missing("carriedWeight", "Fewer than two declared weights are available, so weight is unused.");
        }
        double min = declared.stream().mapToDouble(BigDecimal::doubleValue).min().orElseThrow();
        double max = declared.stream().mapToDouble(BigDecimal::doubleValue).max().orElseThrow();
        if (max == min) {
            return Factor.present("carriedWeight", 0.5, "All declared weights are equal.");
        }
        double score = (max - runner.carriedWeightKg().doubleValue()) / (max - min);
        return Factor.present("carriedWeight", score, "Lighter declared weight scores higher within this field.");
    }

    private static Factor barrier(RaceToPredict race, DeclaredRunner runner, List<HistoricalStart> prior) {
        if (runner.barrier() == null) {
            return Factor.missing("barrier", "Barrier was not supplied and is not treated as zero.");
        }
        if (race.courseName() == null || race.distanceMetres() == null) {
            return Factor.missing("barrier", "Course or distance is missing, so barrier history is unused.");
        }
        List<HistoricalStart> group = prior.stream()
                .filter(HistoricalStart::completed)
                .filter(start -> sameText(start.courseName(), race.courseName()))
                .filter(start -> Objects.equals(start.distanceMetres(), race.distanceMetres()))
                .filter(start -> Objects.equals(start.barrier(), runner.barrier()))
                .toList();
        if (group.size() < MIN_BARRIER_STARTS) {
            return Factor.missing(
                    "barrier",
                    "Barrier sample at this course and distance is " + group.size()
                            + ", below " + MIN_BARRIER_STARTS + ", so barrier is not scored.");
        }
        long wins = group.stream().filter(start -> start.finishingPosition() == 1).count();
        return Factor.present("barrier", (double) wins / group.size(), "Win rate from prior starts in this barrier.");
    }

    private static Factor rest(List<HistoricalStart> completed, Instant cutoff) {
        if (completed.isEmpty()) {
            return Factor.missing("restDays", "No prior start, so rest days are unknown and are not treated as zero.");
        }
        List<HistoricalStart> ordered = completed.stream()
                .sorted(Comparator.comparing(HistoricalStart::ranAt))
                .toList();
        long days = ChronoUnit.DAYS.between(ordered.get(ordered.size() - 1).ranAt(), cutoff);
        List<Integer> samples = new ArrayList<>();
        List<Integer> wins = new ArrayList<>();
        for (int i = 1; i < ordered.size(); i++) {
            long gap = ChronoUnit.DAYS.between(ordered.get(i - 1).ranAt(), ordered.get(i).ranAt());
            if (bucket(gap) == bucket(days)) {
                samples.add(1);
                if (ordered.get(i).finishingPosition() == 1) {
                    wins.add(1);
                }
            }
        }
        if (samples.size() < MIN_REST_SAMPLES) {
            return Factor.missing(
                    "restDays",
                    "Days since the last start are " + days + ", but fewer than " + MIN_REST_SAMPLES
                            + " comparable rests have a result, so rest is not scored.");
        }
        return Factor.present(
                "restDays",
                (double) wins.size() / samples.size(),
                "Win rate after a similar rest. Current gap is " + days + " days.");
    }

    private static int bucket(long days) {
        if (days < 14) {
            return 0;
        }
        if (days <= 60) {
            return 1;
        }
        return 2;
    }

    private static Factor personRate(String name, UUID personId, List<HistoricalStart> prior, boolean jockey) {
        if (personId == null) {
            return Factor.missing(name, (jockey ? "Jockey" : "Trainer") + " was not supplied.");
        }
        int minimum = jockey ? MIN_JOCKEY_RIDES : MIN_TRAINER_RUNNERS;
        List<HistoricalStart> rides = prior.stream()
                .filter(HistoricalStart::completed)
                .filter(start -> personId.equals(jockey ? start.jockeyId() : start.trainerId()))
                .toList();
        if (rides.size() < minimum) {
            return Factor.missing(
                    name,
                    (jockey ? "Jockey" : "Trainer") + " sample is " + rides.size()
                            + ", below " + minimum + ", so this statistic is unused.");
        }
        long wins = rides.stream().filter(start -> start.finishingPosition() == 1).count();
        return Factor.present(name, (double) wins / rides.size(), wins + " wins from " + rides.size() + " completed rides before the cutoff.");
    }

    private static boolean sameText(String left, String right) {
        return left != null && left.equals(right);
    }
}
