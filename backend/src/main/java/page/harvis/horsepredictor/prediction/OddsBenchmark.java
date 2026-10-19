package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;

public record OddsBenchmark(
        String status,
        int raceCount,
        BigDecimal logLoss,
        int ignoredFutureQuotes,
        int ignoredUntimestampedQuotes) {}
