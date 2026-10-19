package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record HistoricalStart(
        UUID horseId,
        Instant ranAt,
        String countryCode,
        Integer distanceMetres,
        String surface,
        String raceClass,
        String going,
        String courseName,
        Integer barrier,
        Integer finishingPosition,
        BigDecimal marginLengths,
        BigDecimal finishTimeSeconds,
        BigDecimal sectionalTimeSeconds,
        UUID jockeyId,
        UUID trainerId) {

    public boolean completed() {
        return finishingPosition != null;
    }
}
