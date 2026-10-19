package page.harvis.horsepredictor.prediction;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RaceToPredict(
        UUID raceId,
        Instant offTime,
        String countryCode,
        Integer distanceMetres,
        String surface,
        String raceClass,
        String going,
        String courseName,
        String raceType,
        List<DeclaredRunner> runners) {}
