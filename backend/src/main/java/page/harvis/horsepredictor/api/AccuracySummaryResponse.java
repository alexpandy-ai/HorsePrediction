package page.harvis.horsepredictor.api;

import java.util.List;
import page.harvis.horsepredictor.prediction.CalibrationBin;
import page.harvis.horsepredictor.prediction.ModelScore;
import page.harvis.horsepredictor.prediction.OddsBenchmark;
import page.harvis.horsepredictor.prediction.SliceScore;

public record AccuracySummaryResponse(
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
