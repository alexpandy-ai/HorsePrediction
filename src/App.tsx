import { useEffect, useRef, useState } from "react";
import { getRace } from "./data";
import { documentTitle, navCurrent, parseRoute, type Route } from "./router";
import { WeightsProvider } from "./weights";
import { CourseView } from "./components/CourseView";
import { CoursesView } from "./components/CoursesView";
import { EngineView } from "./components/EngineView";
import { HomeView } from "./components/HomeView";
import { FormfavHandicapPage } from "./stride/formfav/FormfavHandicapPage";
import { FormfavMeetingPage } from "./stride/formfav/FormfavMeetingPage";
import { FormfavRacePage } from "./stride/formfav/FormfavRacePage";
import { InternationalHome } from "./stride/formfav/InternationalHome";
import { HandicappingPage } from "./stride/HandicappingPage";
import { HomePage } from "./stride/HomePage";
import { MeetingPage } from "./stride/MeetingPage";
import { RaceDetailsPage } from "./stride/RaceDetailsPage";
import { MeetingsView } from "./components/MeetingsView";
import { RaceView } from "./components/RaceView";
import { NotFound } from "./components/bits";

export function App() {
  return (
    <WeightsProvider>
      <Shell />
    </WeightsProvider>
  );
}

function Shell() {
  const route = useRoute();
  const current = navCurrent(route);

  return (
    <div className="app">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="mast">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="M10 8.5c0 7.2 1.6 14 6 14s6-6.8 6-14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M10 22.5h3.2M18.8 22.5H22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <strong>STRIDE</strong>
            <small>Horse racing</small>
          </span>
        </a>
        <nav aria-label="Primary">
          <a href="#/" aria-current={current === "meetings" ? "page" : undefined}>
            Meetings
          </a>
          <a href="#/sample" aria-current={current === "sample" ? "page" : undefined}>
            Sample cards
          </a>
          <a href="#/courses" aria-current={current === "courses" ? "page" : undefined}>
            Courses
          </a>
        </nav>
      </header>
      <main id="content">{renderRoute(route)}</main>
      <footer className="foot">
        <p>
          Indian racecards come from Indiarace. Australia, the United Kingdom, South Africa and New Zealand use a published FormFav snapshot. STRIDE rankings are a separate calculation, not a tip or betting advice.
        </p>
      </footer>
    </div>
  );
}

function renderRoute(route: Route) {
  if (route.name === "home") return <HomePage />;
  if (route.name === "ff-home") return <InternationalHome country={route.country} />;
  if (route.name === "ff-meeting") return <FormfavMeetingPage country={route.country} date={route.date} slug={route.slug} />;
  if (route.name === "ff-race") return <FormfavRacePage country={route.country} date={route.date} slug={route.slug} raceNumber={route.raceNumber} />;
  if (route.name === "ff-handicap") return <FormfavHandicapPage country={route.country} date={route.date} slug={route.slug} raceNumber={route.raceNumber} />;
  if (route.name === "sample") return <HomeView />;
  if (route.name === "meeting") return <MeetingPage date={route.date} venueId={route.venueId} />;
  if (route.name === "race-card") return <RaceDetailsPage date={route.date} venueId={route.venueId} raceNumber={route.raceNumber} />;
  if (route.name === "handicap") return <HandicappingPage date={route.date} venueId={route.venueId} raceNumber={route.raceNumber} />;
  if (route.name === "meetings") return <MeetingsView country={route.country} />;
  if (route.name === "courses") return <CoursesView country={route.country} />;
  if (route.name === "course") return <CourseView courseId={route.courseId} />;
  if (route.name === "engine") return <EngineView raceId={route.raceId} />;
  if (route.name === "race") {
    const race = getRace(route.raceId);
    if (!race) return <NotFound />;
    return <RaceView race={race} runnerId={route.runnerId} />;
  }
  return <NotFound />;
}

function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  const scrollKey = useRef("");

  useEffect(() => {
    const sync = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const route = parseRoute(hash);

  useEffect(() => {
    document.title = documentTitle(parseRoute(hash));
    const parts = hash.split("/");
    const key = parts[1] === "race" ? parts.slice(0, 3).join("/") : hash;
    if (scrollKey.current !== key) {
      scrollKey.current = key;
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return route;
}
