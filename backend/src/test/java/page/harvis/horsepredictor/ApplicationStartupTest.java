package page.harvis.horsepredictor;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("nodb")
class ApplicationStartupTest {

    @LocalServerPort
    private int port;

    @Autowired
    private HorsePredictorApplication application;

    @Test
    void applicationStartsWithoutADatabase() {
        assertThat(application).isNotNull();
    }

    @Test
    void healthSeparatesApplicationStatusFromDatabaseStatus() {
        ResponseEntity<String> response = exchange("/api/v1/health");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).contains("\"service\":\"horsepredictor\"");
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
        assertThat(response.getBody()).contains("\"status\":\"UNAVAILABLE\"");
    }

    @Test
    void actuatorLivenessIsUpWhenTheProcessIsUp() {
        ResponseEntity<String> response =
                client().get().uri("/actuator/health/liveness").retrieve().toEntity(String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void unknownApiPathReturnsNotFound() {
        ResponseEntity<String> response = exchange("/api/v1/does-not-exist");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).doesNotContain("SQLException");
    }

    private ResponseEntity<String> exchange(String path) {
        return client()
                .get()
                .uri(path)
                .accept(MediaType.APPLICATION_JSON)
                .exchange((request, httpResponse) -> {
                    String body = new String(httpResponse.getBody().readAllBytes());
                    return ResponseEntity.status(httpResponse.getStatusCode()).body(body);
                });
    }

    private RestClient client() {
        return RestClient.builder().baseUrl("http://127.0.0.1:" + port).build();
    }
}
