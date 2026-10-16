import { useEffect, useRef, useState } from "react";
import { getRace } from "./data";
import { documentTitle, navCurrent, parseRoute, type Route } from "./router";
import { WeightsProvider } from "./weights";
import { CourseView } from "./components/CourseView";
import { CoursesView } from "./components/CoursesView";
import { EngineView } from "./components/EngineView";
import { HomeView } from "./components/HomeView";
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
            <strong>HorsePrediction</strong>
            <small>Form and handicap</small>
          </span>
        </a>
        <nav aria-label="Primary">
          <a href="#/meetings" aria-current={current === "cards" ? "page" : undefined}>
            Cards
          </a>
          <a href="#/courses" aria-current={current === "courses" ? "page" : undefined}>
            Courses
          </a>
          <a href="#/engine" aria-current={current === "engine" ? "page" : undefined}>
            Handicapper
          </a>
        </nav>
      </header>
      <main id="content">{renderRoute(route)}</main>
      <footer className="foot">
        <p>
          Model scores compare runners on a card. They are an analytical aid, not a tip, a guaranteed result, or
          betting advice.
        </p>
      </footer>
    </div>
  );
}

function renderRoute(route: Route) {
  if (route.name === "home") return <HomeView />;
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
