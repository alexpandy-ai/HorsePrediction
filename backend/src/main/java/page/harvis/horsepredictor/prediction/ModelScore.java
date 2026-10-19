package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;

public record ModelScore(
        String modelVersion,
        int raceCount,
        BigDecimal topRankedStrikeRate,
        BigDecimal logLoss,
        BigDecimal brierScore) {

    public static ModelScore empty(String modelVersion) {
        return new ModelScore(modelVersion, 0, null, null, null);
    }
}
