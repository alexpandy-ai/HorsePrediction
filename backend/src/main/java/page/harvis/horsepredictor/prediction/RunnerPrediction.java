package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record RunnerPrediction(UUID runnerEntryId, BigDecimal probability, Integer rank, List<Factor> factors) {}
