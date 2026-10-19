package page.harvis.horsepredictor.racing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "horse")
public class Horse {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    protected Horse() {}

    public Horse(UUID id, String name) {
        this.id = id;
        this.name = name;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
