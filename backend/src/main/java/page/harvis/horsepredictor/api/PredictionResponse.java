package page.harvis.horsepredictor.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PredictionResponse(
        UUID predictionId,
        UUID raceId,
        String status,
        String modelVersion,
        Instant predictedAt,
        Instant featureCutoff,
        String message,
        BigDecimal probabilitySum,
        List<RunnerPredictionResponse> runners) {}
