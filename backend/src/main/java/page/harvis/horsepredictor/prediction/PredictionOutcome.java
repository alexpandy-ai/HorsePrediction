package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PredictionOutcome(
        String modelVersion,
        PredictionStatus status,
        String message,
        Instant featureCutoff,
        BigDecimal probabilitySum,
        List<RunnerPrediction> runners) {}
