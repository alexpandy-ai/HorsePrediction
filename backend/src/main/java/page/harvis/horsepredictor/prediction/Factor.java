package page.harvis.horsepredictor.prediction;

public record Factor(String name, boolean available, Double value, String detail) {

    public static Factor missing(String name, String detail) {
        return new Factor(name, false, null, detail);
    }

    public static Factor present(String name, double value, String detail) {
        return new Factor(name, true, value, detail);
    }
}
