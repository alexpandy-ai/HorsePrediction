export const FORMFAV_COUNTRY_CODES = ["au", "gb", "za", "nz"] as const;

export type FormfavCountryCode = (typeof FORMFAV_COUNTRY_CODES)[number];

export interface FormfavCountry {
  code: FormfavCountryCode;
  name: string;
  file: string;
  calendarTimezone: string;
  /** Timezones used only to choose which local date the meetings request covers. */
  requestTimezones: string[];
}

export const FORMFAV_COUNTRIES: FormfavCountry[] = [
  {
    code: "au",
    name: "Australia",
    file: "meetings-au.json",
    calendarTimezone: "Australia/Sydney",
    requestTimezones: ["Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth", "Australia/Darwin"],
  },
  {
    code: "gb",
    name: "United Kingdom",
    file: "meetings-uk.json",
    calendarTimezone: "Europe/London",
    requestTimezones: ["Europe/London"],
  },
  {
    code: "za",
    name: "South Africa",
    file: "meetings-za.json",
    calendarTimezone: "Africa/Johannesburg",
    requestTimezones: ["Africa/Johannesburg"],
  },
  {
    code: "nz",
    name: "New Zealand",
    file: "meetings-nz.json",
    calendarTimezone: "Pacific/Auckland",
    requestTimezones: ["Pacific/Auckland"],
  },
];

export function isFormfavCountry(value: string): value is FormfavCountryCode {
  return (FORMFAV_COUNTRY_CODES as readonly string[]).includes(value);
}

export function formfavCountry(code: FormfavCountryCode): FormfavCountry {
  const country = FORMFAV_COUNTRIES.find((item) => item.code === code);
  if (!country) throw new Error(`Unknown FormFav country ${code}`);
  return country;
}
