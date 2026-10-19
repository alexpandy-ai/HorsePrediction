package page.harvis.horsepredictor.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI horsepredictorOpenApi() {
        return new OpenAPI().info(new Info()
                .title("HorsePredictor API")
                .version("0.1.0")
                .description(
                        "Probability estimates for declared runners. An insufficient-data status means no reliable prediction was made. Estimates are not guarantees."));
    }
}
