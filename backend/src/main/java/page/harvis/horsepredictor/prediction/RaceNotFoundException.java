package page.harvis.horsepredictor.prediction;

import java.util.UUID;

public class RaceNotFoundException extends RuntimeException {

    public RaceNotFoundException(UUID raceId) {
        super("Race " + raceId + " was not found.");
    }
}
