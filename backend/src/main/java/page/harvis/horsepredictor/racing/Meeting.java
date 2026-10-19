package page.harvis.horsepredictor.racing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "meeting")
public class Meeting {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(name = "meeting_date", nullable = false)
    private LocalDate meetingDate;

    protected Meeting() {}

    public Meeting(UUID id, Venue venue, LocalDate meetingDate) {
        this.id = id;
        this.venue = venue;
        this.meetingDate = meetingDate;
    }

    public UUID getId() {
        return id;
    }

    public Venue getVenue() {
        return venue;
    }

    public LocalDate getMeetingDate() {
        return meetingDate;
    }
}
