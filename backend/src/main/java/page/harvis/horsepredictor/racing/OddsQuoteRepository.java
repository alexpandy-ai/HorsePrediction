package page.harvis.horsepredictor.racing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OddsQuoteRepository extends JpaRepository<OddsQuote, UUID> {

    @Query("""
            select q from OddsQuote q
            join fetch q.runnerEntry entry
            join fetch entry.race
            """)
    List<OddsQuote> findAllWithRaces();
}
