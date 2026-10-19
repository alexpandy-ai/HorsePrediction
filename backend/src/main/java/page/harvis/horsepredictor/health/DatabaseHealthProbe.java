package page.harvis.horsepredictor.health;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class DatabaseHealthProbe {

    private static final Logger log = LoggerFactory.getLogger(DatabaseHealthProbe.class);

    private final ObjectProvider<DataSource> dataSource;

    public DatabaseHealthProbe(ObjectProvider<DataSource> dataSource) {
        this.dataSource = dataSource;
    }

    public DatabaseHealth check() {
        DataSource source = dataSource.getIfAvailable();
        if (source == null) {
            return new DatabaseHealth("UNAVAILABLE", "No database is configured");
        }
        try (Connection connection = source.getConnection();
                Statement statement = connection.createStatement()) {
            statement.execute("SELECT 1");
            return new DatabaseHealth("UP", null);
        } catch (SQLException exception) {
            log.warn("Database health check failed. SQLState={}", exception.getSQLState());
            return new DatabaseHealth("DOWN", "Database is not reachable");
        }
    }
}
