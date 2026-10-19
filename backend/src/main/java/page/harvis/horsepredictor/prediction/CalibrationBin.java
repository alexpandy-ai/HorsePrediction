package page.harvis.horsepredictor.prediction;

import java.math.BigDecimal;

public record CalibrationBin(String label, int count, BigDecimal meanPredicted, BigDecimal observedFrequency) {}
