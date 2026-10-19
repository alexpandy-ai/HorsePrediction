package page.harvis.horsepredictor.racing;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StoredPredictionRepository extends JpaRepository<StoredPrediction, UUID> {

    Optional<StoredPrediction> findFirstByRace_IdAndModelVersionOrderByCreatedAtDesc(UUID raceId, String modelVersion);

    @Query("""
            select distinct p from StoredPrediction p
            left join fetch p.runners r
            left join fetch r.runnerEntry
            where p.id = :id
            """)
    Optional<StoredPrediction> findWithRunnersById(@Param("id") UUID id);
}
