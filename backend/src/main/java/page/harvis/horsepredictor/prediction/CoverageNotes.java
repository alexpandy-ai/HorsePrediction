package page.harvis.horsepredictor.prediction;

import java.util.List;

public final class CoverageNotes {

    public static final String DISCLAIMER =
            "These are probability estimates, not guarantees. No profitability or accuracy claim is made.";

    public static final List<String> ALWAYS = List.of(
            DISCLAIMER,
            "Missing sectional times, finish times, margins, barriers, and weights are left unused. They are not scored as zero.",
            "A country with no stored official results cannot support a reliable prediction.",
            "Demonstration cards and sample history are not official results and are not read here.");

    private CoverageNotes() {}
}
