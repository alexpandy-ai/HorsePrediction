package page.harvis.horsepredictor.racing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "odds_quote")
public class OddsQuote {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_entry_id", nullable = false)
    private RunnerEntry runnerEntry;

    @Column(name = "quoted_at")
    private Instant quotedAt;

    @Column(name = "decimal_odds", nullable = false, precision = 10, scale = 3)
    private BigDecimal decimalOdds;

    @Column(nullable = false, length = 80)
    private String source;

    protected OddsQuote() {}

    public UUID getId() {
        return id;
    }

    public RunnerEntry getRunnerEntry() {
        return runnerEntry;
    }

    public Instant getQuotedAt() {
        return quotedAt;
    }

    public BigDecimal getDecimalOdds() {
        return decimalOdds;
    }

    public String getSource() {
        return source;
    }
}
