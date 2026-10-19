package page.harvis.horsepredictor;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import page.harvis.horsepredictor.api.HealthController;
import page.harvis.horsepredictor.health.DatabaseHealth;
import page.harvis.horsepredictor.health.DatabaseHealthProbe;

@WebMvcTest(HealthController.class)
class HealthEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DatabaseHealthProbe databaseHealthProbe;

    @Test
    void reportsServiceUpWhenDatabaseIsUp() throws Exception {
        when(databaseHealthProbe.check()).thenReturn(new DatabaseHealth("UP", null));

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("horsepredictor"))
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database.status").value("UP"))
                .andExpect(jsonPath("$.database.detail").doesNotExist());
    }

    @Test
    void reportsDatabaseSeparatelyWhenItIsDown() throws Exception {
        when(databaseHealthProbe.check()).thenReturn(new DatabaseHealth("DOWN", "Database is not reachable"));

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.service").value("horsepredictor"))
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database.status").value("DOWN"))
                .andExpect(jsonPath("$.database.detail").value("Database is not reachable"));
    }

    @Test
    void returnsJsonWhenTheHealthCheckFailsUnexpectedly() throws Exception {
        when(databaseHealthProbe.check()).thenThrow(new IllegalStateException("connection string hidden"));

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                .andExpect(jsonPath("$.message").doesNotExist());
    }
}
