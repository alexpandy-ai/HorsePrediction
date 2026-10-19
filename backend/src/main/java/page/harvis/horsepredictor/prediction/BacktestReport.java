package page.harvis.horsepredictor.prediction;

import java.util.List;

public record BacktestReport(
        String status,
        int racesSupplied,
        int racesScored,
        ModelScore evidence,
        ModelScore baseline,
        OddsBenchmark oddsBenchmark,
        List<SliceScore> byCountry,
        List<SliceScore> byDistance,
        List<SliceScore> byRaceType,
        List<CalibrationBin> calibration,
        List<String> limitations) {}
