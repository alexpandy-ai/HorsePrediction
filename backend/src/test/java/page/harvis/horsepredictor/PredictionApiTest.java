package page.harvis.horsepredictor;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import page.harvis.horsepredictor.api.AccuracySummaryResponse;
import page.harvis.horsepredictor.api.PredictionController;
import page.harvis.horsepredictor.api.PredictionResponse;
import page.harvis.horsepredictor.prediction.ModelScore;
import page.harvis.horsepredictor.prediction.OddsBenchmark;
import page.harvis.horsepredictor.prediction.PredictionApplicationService;
import page.harvis.horsepredictor.prediction.PredictionNotFoundException;
import page.harvis.horsepredictor.prediction.RaceNotFoundException;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PredictionController.class)
class PredictionApiTest {

    private static final UUID RACE_ID = UUID.fromString("00000000-0000-0000-0000-000000000301");
    private static final UUID PREDICTION_ID = UUID.fromString("00000000-0000-0000-0000-000000000302");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PredictionApplicationService predictions;

    @Test
    void racePredictionReportsInsufficientData() throws Exception {
        when(predictions.predictionFor(RACE_ID)).thenReturn(sample("INSUFFICIENT_DATA", null));

        mockMvc.perform(get("/api/v1/races/{raceId}/prediction", RACE_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INSUFFICIENT_DATA"))
                .andExpect(jsonPath("$.modelVersion").value("evidence-winrate-v1"))
                .andExpect(jsonPath("$.probabilitySum").value(nullValue()));
    }

    @Test
    void storedPredictionIsReadable() throws Exception {
        when(predictions.predictionById(PREDICTION_ID)).thenReturn(sample("READY", new BigDecimal("1.0000")));

        mockMvc.perform(get("/api/v1/predictions/{predictionId}", PREDICTION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.predictionId").value(PREDICTION_ID.toString()))
                .andExpect(jsonPath("$.probabilitySum").value(1.0));
    }

    @Test
    void missingRaceAndPredictionReturnNotFound() throws Exception {
        when(predictions.predictionFor(RACE_ID)).thenThrow(new RaceNotFoundException(RACE_ID));
        when(predictions.predictionById(PREDICTION_ID)).thenThrow(new PredictionNotFoundException(PREDICTION_ID));

        mockMvc.perform(get("/api/v1/races/{raceId}/prediction", RACE_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Not Found"));
        mockMvc.perform(get("/api/v1/predictions/{predictionId}", PREDICTION_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void accuracySummaryExposesSeparateMetrics() throws Exception {
        when(predictions.accuracy()).thenReturn(new AccuracySummaryResponse(
                "INSUFFICIENT_DATA",
                0,
                0,
                ModelScore.empty("evidence-winrate-v1"),
                ModelScore.empty("equal-probability-v1"),
                new OddsBenchmark("UNAVAILABLE", 0, null, 0, 0),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("No profitability or accuracy claim is made.")));

        mockMvc.perform(get("/api/v1/accuracy/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INSUFFICIENT_DATA"))
                .andExpect(jsonPath("$.evidence.logLoss").value(nullValue()))
                .andExpect(jsonPath("$.baseline.modelVersion").value("equal-probability-v1"))
                .andExpect(jsonPath("$.oddsBenchmark.status").value("UNAVAILABLE"));
    }

    private static PredictionResponse sample(String status, BigDecimal sum) {
        return new PredictionResponse(
                PREDICTION_ID,
                RACE_ID,
                status,
                "evidence-winrate-v1",
                Instant.parse("2026-10-19T12:00:00Z"),
                Instant.parse("2026-10-19T08:00:00Z"),
                "These are probability estimates, not guarantees.",
                sum,
                List.of());
    }
}
