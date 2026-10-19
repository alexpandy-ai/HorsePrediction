package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;

public record SliceScore(
        String key, int raceCount, BigDecimal topRankedStrikeRate, BigDecimal logLoss, BigDecimal brierScore) {}
