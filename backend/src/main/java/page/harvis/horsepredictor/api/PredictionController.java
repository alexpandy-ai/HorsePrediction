package page.harvis.horsepredictor.api;

import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import page.harvis.horsepredictor.prediction.PredictionApplicationService;

@RestController
@Profile("!nodb")
@RequestMapping("/api/v1")
public class PredictionController {

    private final PredictionApplicationService predictions;

    public PredictionController(PredictionApplicationService predictions) {
        this.predictions = predictions;
    }

    @GetMapping("/races/{raceId}/prediction")
    public PredictionResponse prediction(@PathVariable UUID raceId) {
        return predictions.predictionFor(raceId);
    }

    @GetMapping("/predictions/{predictionId}")
    public PredictionResponse storedPrediction(@PathVariable UUID predictionId) {
        return predictions.predictionById(predictionId);
    }

    @GetMapping("/accuracy/summary")
    public AccuracySummaryResponse accuracy() {
        return predictions.accuracy();
    }
}
