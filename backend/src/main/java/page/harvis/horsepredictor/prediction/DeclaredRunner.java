package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.util.UUID;

public record DeclaredRunner(
        UUID runnerEntryId,
        UUID horseId,
        UUID jockeyId,
        UUID trainerId,
        Integer barrier,
        BigDecimal carriedWeightKg,
        boolean withdrawn) {}
