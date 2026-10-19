package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OddsQuoteView(UUID runnerEntryId, Instant quotedAt, BigDecimal decimalOdds) {}
