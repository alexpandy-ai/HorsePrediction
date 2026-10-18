import { FORMFAV_COUNTRIES, type FormfavCountryCode } from "./countries";

export function CountryTabs({ current }: { current: "in" | FormfavCountryCode }) {
  return (
    <div className="stride-toolbar" aria-label="Country">
      <a href="#/" aria-current={current === "in" ? "page" : undefined}>
        India
      </a>
      {FORMFAV_COUNTRIES.map((country) => (
        <a key={country.code} href={`#/ff/${country.code}`} aria-current={current === country.code ? "page" : undefined}>
          {country.name}
        </a>
      ))}
    </div>
  );
}
