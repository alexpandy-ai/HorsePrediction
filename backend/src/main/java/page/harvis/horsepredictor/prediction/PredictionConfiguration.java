package page.harvis.horsepredictor.prediction;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!nodb")
public class PredictionConfiguration {

    @Bean
    Clock predictionClock() {
        return Clock.systemUTC();
    }
}
