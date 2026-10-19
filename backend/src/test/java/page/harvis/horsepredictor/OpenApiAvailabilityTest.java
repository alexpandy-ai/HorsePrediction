package page.harvis.horsepredictor;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("nodb")
class OpenApiAvailabilityTest {

    @LocalServerPort
    private int port;

    @Test
    void openApiDocumentListsTheHealthEndpoint() {
        ResponseEntity<String> response = client().get().uri("/v3/api-docs").retrieve().toEntity(String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"openapi\"");
        assertThat(response.getBody()).contains("HorsePredictor API");
        assertThat(response.getBody()).contains("/api/v1/health");
    }

    @Test
    void swaggerUiIsAvailable() {
        ResponseEntity<String> response = client()
                .get()
                .uri("/swagger-ui/index.html")
                .exchange((request, httpResponse) -> {
                    String body = new String(httpResponse.getBody().readAllBytes());
                    return ResponseEntity.status(httpResponse.getStatusCode()).body(body);
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("swagger");
    }

    private RestClient client() {
        return RestClient.builder().baseUrl("http://127.0.0.1:" + port).build();
    }
}
