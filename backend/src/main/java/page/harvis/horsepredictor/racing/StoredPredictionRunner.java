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
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "prediction_runner")
public class StoredPredictionRunner {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prediction_id", nullable = false)
    private StoredPrediction prediction;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_entry_id", nullable = false)
    private RunnerEntry runnerEntry;

    @Column(precision = 8, scale = 4)
    private BigDecimal probability;

    @Column(name = "rank_position")
    private Integer rankPosition;

    @OneToMany(mappedBy = "predictionRunner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StoredPredictionFactor> factors = new ArrayList<>();

    protected StoredPredictionRunner() {}

    public StoredPredictionRunner(UUID id, RunnerEntry runnerEntry, BigDecimal probability, Integer rankPosition) {
        this.id = id;
        this.runnerEntry = runnerEntry;
        this.probability = probability;
        this.rankPosition = rankPosition;
    }

    void attach(StoredPrediction prediction) {
        this.prediction = prediction;
    }

    public void addFactor(StoredPredictionFactor factor) {
        factors.add(factor);
        factor.attach(this);
    }

    public UUID getId() {
        return id;
    }

    public StoredPrediction getPrediction() {
        return prediction;
    }

    public RunnerEntry getRunnerEntry() {
        return runnerEntry;
    }

    public BigDecimal getProbability() {
        return probability;
    }

    public Integer getRankPosition() {
        return rankPosition;
    }

    public List<StoredPredictionFactor> getFactors() {
        return factors;
    }
}
