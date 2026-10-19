package page.harvis.horsepredictor;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import page.harvis.horsepredictor.foundation.SchemaFoundationRepository;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class PostgresFoundationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

    @LocalServerPort
    private int port;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private SchemaFoundationRepository schemaFoundationRepository;

    @Test
    void healthReportsTheDatabaseUp() {
        ResponseEntity<String> response = client().get().uri("/api/v1/health").retrieve().toEntity(String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"service\":\"horsepredictor\"");
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void actuatorReadinessIncludesTheDatabase() {
        ResponseEntity<String> response =
                client().get().uri("/actuator/health/readiness").retrieve().toEntity(String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"db\"");
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void flywayMigrationCreatesEmptyRacingTables() throws Exception {
        assertThat(schemaFoundationRepository.findById((short) 1)).hasValueSatisfying(row -> {
            assertThat(row.getName()).isEqualTo("horsepredictor");
            assertThat(row.getCreatedAt()).isNotNull();
        });

        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
            try (ResultSet history = statement.executeQuery(
                    "SELECT version, success FROM flyway_schema_history WHERE version IN ('1', '2') ORDER BY version")) {
                assertThat(history.next()).isTrue();
                assertThat(history.getBoolean("success")).isTrue();
                assertThat(history.next()).isTrue();
                assertThat(history.getBoolean("success")).isTrue();
            }
            try (ResultSet races = statement.executeQuery("SELECT COUNT(*) FROM race")) {
                assertThat(races.next()).isTrue();
                assertThat(races.getInt(1)).isZero();
            }
            try (ResultSet stored = statement.executeQuery("SELECT COUNT(*) FROM prediction")) {
                assertThat(stored.next()).isTrue();
                assertThat(stored.getInt(1)).isZero();
            }
        }
    }

    private RestClient client() {
        return RestClient.builder().baseUrl("http://127.0.0.1:" + port).build();
    }
}
