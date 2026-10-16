import { countries, getRace, races, runners } from "../data";
import { FACTORS, analyse } from "../engine/handicap";
import { useWeights } from "../weights";
import { DemoNote, NotFound } from "./bits";
import { ModelPanel } from "./ModelPanel";

export function EngineView({ raceId }: { raceId?: string }) {
  const { weights, setWeight, reset } = useWeights();
  const race = raceId ? getRace(raceId) : races.find((item) => item.feature) ?? races[0];
  if (!race) return <NotFound />;
  if (raceId && !getRace(raceId)) return <NotFound />;
  const analysis = analyse(
    race,
    runners.filter((runner) => runner.raceId === race.id),
    weights,
  );

  return (
    <div className="wrap">
      <p className="kicker">Handicapper</p>
      <h1>Retune the model, then read the ranking.</h1>
      <p className="lede">
        The official rating stays on the card. These eight factors are calculated from the demonstration form, and you
        can change how much each one counts.
      </p>
      <DemoNote />
      <label className="race-pick">
        <span>Race</span>
        <select
          value={race.id}
          onChange={(event) => {
            window.location.hash = `#/engine/${event.target.value}`;
          }}
        >
          {countries.map((country) => (
            <optgroup key={country.id} label={country.name}>
              {races
                .filter((item) => item.countryId === country.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    R{item.number} {item.name} · {item.distanceLabel} {item.classLabel}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <ModelPanel
        race={race}
        analysis={analysis}
        weights={weights}
        onWeight={setWeight}
        onReset={reset}
        detailed
      />
      <section>
        <h2>What each factor uses</h2>
        <ul className="method">
          {FACTORS.map((factor) => (
            <li key={factor.key}>
              <strong>{factor.label}.</strong> {factor.blurb}
            </li>
          ))}
        </ul>
        <p className="meta">
          Running style is a model classification, not a printed card field. Official ratings, weights, draws, form
          figures, and days since the last run stay in the official columns on the race card.
        </p>
      </section>
    </div>
  );
}
