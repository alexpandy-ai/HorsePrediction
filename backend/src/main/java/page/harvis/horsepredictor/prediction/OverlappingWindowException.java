package page.harvis.horsepredictor.prediction;

import java.time.Instant;

public class OverlappingWindowException extends IllegalArgumentException {

    public OverlappingWindowException(Instant trainingEnd, Instant evaluationStart) {
        super("Evaluation start " + evaluationStart + " is not after training end " + trainingEnd + ".");
    }
}
