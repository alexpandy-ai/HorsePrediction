package page.harvis.horsepredictor.racing;

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
@Table(name = "race")
public class Race {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @Column(name = "off_time", nullable = false)
    private Instant offTime;

    @Column(name = "country_code", nullable = false, length = 8)
    private String countryCode;

    @Column(name = "distance_metres")
    private Integer distanceMetres;

    @Column(length = 40)
    private String surface;

    @Column(name = "race_class", length = 40)
    private String raceClass;

    @Column(length = 40)
    private String going;

    @Column(name = "race_type", length = 40)
    private String raceType;

    @Column(name = "course_name", length = 120)
    private String courseName;

    @OneToMany(mappedBy = "race")
    private List<RunnerEntry> entries = new ArrayList<>();

    protected Race() {}

    public Race(
            UUID id,
            Meeting meeting,
            Instant offTime,
            String countryCode,
            Integer distanceMetres,
            String surface,
            String raceClass,
            String going,
            String raceType,
            String courseName) {
        this.id = id;
        this.meeting = meeting;
        this.offTime = offTime;
        this.countryCode = countryCode;
        this.distanceMetres = distanceMetres;
        this.surface = surface;
        this.raceClass = raceClass;
        this.going = going;
        this.raceType = raceType;
        this.courseName = courseName;
    }

    public UUID getId() {
        return id;
    }

    public Meeting getMeeting() {
        return meeting;
    }

    public Instant getOffTime() {
        return offTime;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public Integer getDistanceMetres() {
        return distanceMetres;
    }

    public String getSurface() {
        return surface;
    }

    public String getRaceClass() {
        return raceClass;
    }

    public String getGoing() {
        return going;
    }

    public String getRaceType() {
        return raceType;
    }

    public String getCourseName() {
        return courseName;
    }

    public List<RunnerEntry> getEntries() {
        return entries;
    }

    public void addEntry(RunnerEntry entry) {
        entries.add(entry);
    }
}
