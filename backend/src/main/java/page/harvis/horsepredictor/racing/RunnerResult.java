package page.harvis.horsepredictor.racing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "runner_result")
public class RunnerResult {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_entry_id", nullable = false, unique = true)
    private RunnerEntry runnerEntry;

    @Column(name = "finishing_position")
    private Integer finishingPosition;

    @Column(name = "margin_lengths", precision = 8, scale = 3)
    private BigDecimal marginLengths;

    @Column(name = "finish_time_seconds", precision = 10, scale = 3)
    private BigDecimal finishTimeSeconds;

    @Column(name = "sectional_time_seconds", precision = 10, scale = 3)
    private BigDecimal sectionalTimeSeconds;

    protected RunnerResult() {}

    public RunnerResult(
            UUID id,
            RunnerEntry runnerEntry,
            Integer finishingPosition,
            BigDecimal marginLengths,
            BigDecimal finishTimeSeconds,
            BigDecimal sectionalTimeSeconds) {
        this.id = id;
        this.runnerEntry = runnerEntry;
        this.finishingPosition = finishingPosition;
        this.marginLengths = marginLengths;
        this.finishTimeSeconds = finishTimeSeconds;
        this.sectionalTimeSeconds = sectionalTimeSeconds;
    }

    public UUID getId() {
        return id;
    }

    public RunnerEntry getRunnerEntry() {
        return runnerEntry;
    }

    public Integer getFinishingPosition() {
        return finishingPosition;
    }

    public BigDecimal getMarginLengths() {
        return marginLengths;
    }

    public BigDecimal getFinishTimeSeconds() {
        return finishTimeSeconds;
    }

    public BigDecimal getSectionalTimeSeconds() {
        return sectionalTimeSeconds;
    }
}
