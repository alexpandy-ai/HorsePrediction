package page.harvis.horsepredictor.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record RunnerPredictionResponse(
        UUID runnerEntryId, BigDecimal probability, Integer rank, List<FactorResponse> factors) {}
