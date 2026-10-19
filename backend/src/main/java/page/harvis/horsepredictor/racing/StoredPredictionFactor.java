package page.harvis.horsepredictor.racing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "prediction_factor")
public class StoredPredictionFactor {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prediction_runner_id", nullable = false)
    private StoredPredictionRunner predictionRunner;

    @Column(name = "factor_name", nullable = false, length = 64)
    private String factorName;

    @Column(nullable = false)
    private boolean available;

    @Column(name = "numeric_value")
    private Double numericValue;

    @Column(nullable = false, length = 400)
    private String detail;

    protected StoredPredictionFactor() {}

    public StoredPredictionFactor(UUID id, String factorName, boolean available, Double numericValue, String detail) {
        this.id = id;
        this.factorName = factorName;
        this.available = available;
        this.numericValue = numericValue;
        this.detail = trim(detail);
    }

    void attach(StoredPredictionRunner predictionRunner) {
        this.predictionRunner = predictionRunner;
    }

    public UUID getId() {
        return id;
    }

    public String getFactorName() {
        return factorName;
    }

    public boolean isAvailable() {
        return available;
    }

    public Double getNumericValue() {
        return numericValue;
    }

    public String getDetail() {
        return detail;
    }

    private static String trim(String detail) {
        if (detail == null) {
            return "";
        }
        return detail.length() <= 400 ? detail : detail.substring(0, 400);
    }
}
