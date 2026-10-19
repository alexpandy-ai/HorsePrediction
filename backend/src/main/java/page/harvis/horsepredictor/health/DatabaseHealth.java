package page.harvis.horsepredictor.health;

import java.util.LinkedHashMap;
import java.util.Map;

public record DatabaseHealth(String status, String detail) {

    public boolean up() {
        return "UP".equals(status);
    }

    public Map<String, Object> toBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        if (detail != null && !detail.isBlank()) {
            body.put("detail", detail);
        }
        return body;
    }
}
