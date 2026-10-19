package page.harvis.horsepredictor.prediction;

import java.util.UUID;

public class PredictionNotFoundException extends RuntimeException {

    public PredictionNotFoundException(UUID predictionId) {
        super("Prediction " + predictionId + " was not found.");
    }
}
