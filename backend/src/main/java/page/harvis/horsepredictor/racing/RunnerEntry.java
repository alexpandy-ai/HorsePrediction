package page.harvis.horsepredictor.racing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "runner_entry")
public class RunnerEntry {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "race_id", nullable = false)
    private Race race;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "horse_id", nullable = false)
    private Horse horse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jockey_id")
    private Person jockey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id")
    private Person trainer;

    @Column(name = "horse_number")
    private Integer horseNumber;

    private Integer barrier;

    @Column(name = "carried_weight_kg", precision = 6, scale = 2)
    private BigDecimal carriedWeightKg;

    @Column(nullable = false)
    private boolean withdrawn;

    @OneToOne(mappedBy = "runnerEntry", fetch = FetchType.LAZY)
    private RunnerResult result;

    protected RunnerEntry() {}

    public RunnerEntry(
            UUID id,
            Race race,
            Horse horse,
            Person jockey,
            Person trainer,
            Integer horseNumber,
            Integer barrier,
            BigDecimal carriedWeightKg,
            boolean withdrawn) {
        this.id = id;
        this.race = race;
        this.horse = horse;
        this.jockey = jockey;
        this.trainer = trainer;
        this.horseNumber = horseNumber;
        this.barrier = barrier;
        this.carriedWeightKg = carriedWeightKg;
        this.withdrawn = withdrawn;
    }

    public UUID getId() {
        return id;
    }

    public Race getRace() {
        return race;
    }

    public Horse getHorse() {
        return horse;
    }

    public Person getJockey() {
        return jockey;
    }

    public Person getTrainer() {
        return trainer;
    }

    public Integer getHorseNumber() {
        return horseNumber;
    }

    public Integer getBarrier() {
        return barrier;
    }

    public BigDecimal getCarriedWeightKg() {
        return carriedWeightKg;
    }

    public boolean isWithdrawn() {
        return withdrawn;
    }

    public void markWithdrawn() {
        this.withdrawn = true;
    }

    public RunnerResult getResult() {
        return result;
    }
}
