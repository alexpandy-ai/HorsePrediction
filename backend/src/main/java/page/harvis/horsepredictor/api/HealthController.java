package page.harvis.horsepredictor.api;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import page.harvis.horsepredictor.health.DatabaseHealth;
import page.harvis.horsepredictor.health.DatabaseHealthProbe;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    static final String SERVICE = "horsepredictor";

    private final DatabaseHealthProbe databaseHealthProbe;

    public HealthController(DatabaseHealthProbe databaseHealthProbe) {
        this.databaseHealthProbe = databaseHealthProbe;
    }

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> health() {
        DatabaseHealth database = databaseHealthProbe.check();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", SERVICE);
        body.put("status", "UP");
        body.put("database", database.toBody());
        HttpStatus httpStatus = database.up() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(httpStatus).body(body);
    }
}
