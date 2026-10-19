package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

public final class ProbabilityMath {

    private ProbabilityMath() {}

    public static List<BigDecimal> softmax(List<Double> scores) {
        if (scores.isEmpty()) {
            return List.of();
        }
        double max = scores.stream().mapToDouble(Double::doubleValue).max().orElse(0);
        List<Double> weights = scores.stream().map(score -> Math.exp(score - max)).toList();
        return allocate(weights);
    }

    public static List<BigDecimal> equalShares(int runners) {
        if (runners < 1) {
            return List.of();
        }
        List<Double> weights = new ArrayList<>();
        for (int i = 0; i < runners; i++) {
            weights.add(1.0);
        }
        return allocate(weights);
    }

    public static List<BigDecimal> allocate(List<Double> positiveWeights) {
        double sum = positiveWeights.stream().mapToDouble(Double::doubleValue).sum();
        if (sum <= 0 || !Double.isFinite(sum)) {
            throw new IllegalArgumentException("Probability weights must be positive.");
        }
        List<BigDecimal> rounded = new ArrayList<>();
        int largest = 0;
        for (int i = 0; i < positiveWeights.size(); i++) {
            BigDecimal share = BigDecimal.valueOf(positiveWeights.get(i) / sum).setScale(4, RoundingMode.HALF_UP);
            rounded.add(share);
            if (share.compareTo(rounded.get(largest)) > 0) {
                largest = i;
            }
        }
        BigDecimal total = rounded.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal drift = BigDecimal.ONE.setScale(4).subtract(total);
        rounded.set(largest, rounded.get(largest).add(drift));
        return List.copyOf(rounded);
    }

    public static BigDecimal sum(List<BigDecimal> probabilities) {
        return probabilities.stream().reduce(BigDecimal.ZERO.setScale(4), BigDecimal::add);
    }
}
