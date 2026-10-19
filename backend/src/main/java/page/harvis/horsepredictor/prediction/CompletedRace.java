package page.harvis.horsepredictor.prediction;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CompletedRace(RaceToPredict race, Map<UUID, Integer> finishingPositionByRunner, List<OddsQuoteView> quotes) {}
