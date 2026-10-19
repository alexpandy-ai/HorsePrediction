package page.harvis.horsepredictor.racing;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "prediction")
public class StoredPrediction {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "race_id", nullable = false)
    private Race race;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "model_version", nullable = false, length = 64)
    private String modelVersion;

    @Column(name = "feature_cutoff", nullable = false)
    private Instant featureCutoff;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "declaration_fingerprint", nullable = false, length = 128)
    private String declarationFingerprint;

    @Column(nullable = false, length = 1000)
    private String message;

    @OneToMany(mappedBy = "prediction", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StoredPredictionRunner> runners = new ArrayList<>();

    protected StoredPrediction() {}

    public StoredPrediction(
            UUID id,
            Race race,
            Instant createdAt,
            String modelVersion,
            Instant featureCutoff,
            String status,
            String declarationFingerprint,
            String message) {
        this.id = id;
        this.race = race;
        this.createdAt = createdAt;
        this.modelVersion = modelVersion;
        this.featureCutoff = featureCutoff;
        this.status = status;
        this.declarationFingerprint = declarationFingerprint;
        this.message = message;
    }

    public void addRunner(StoredPredictionRunner runner) {
        runners.add(runner);
        runner.attach(this);
    }

    public UUID getId() {
        return id;
    }

    public Race getRace() {
        return race;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public Instant getFeatureCutoff() {
        return featureCutoff;
    }

    public String getStatus() {
        return status;
    }

    public String getDeclarationFingerprint() {
        return declarationFingerprint;
    }

    public String getMessage() {
        return message;
    }

    public List<StoredPredictionRunner> getRunners() {
        return runners;
    }
}
