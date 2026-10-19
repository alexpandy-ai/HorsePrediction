package page.harvis.horsepredictor.racing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RaceRepository extends JpaRepository<Race, UUID> {

    @Query("""
            select distinct r from Race r
            left join fetch r.entries e
            left join fetch e.horse
            left join fetch e.jockey
            left join fetch e.trainer
            left join fetch e.result
            """)
    List<Race> findAllForBacktest();

    @Query("""
            select distinct r from Race r
            left join fetch r.entries e
            left join fetch e.horse
            left join fetch e.jockey
            left join fetch e.trainer
            left join fetch e.result
            where r.id = :id
            """)
    Optional<Race> findWithEntriesById(@Param("id") UUID id);
}
