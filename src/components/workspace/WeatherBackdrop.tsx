import { useEffect, useState, type CSSProperties } from "react";
import { CloudSun, MapPin, Pause, Play, X } from "lucide-react";

type Place = { name: string; latitude: number; longitude: number };
type Period = { startTime: string; endTime: string; isDaytime: boolean; temperature: number; temperatureUnit: string; shortForecast: string; windSpeed: string };
type Forecast = { periods: Period[]; updated: number; timeZone: string };
async function requestJson(url: string, signal?: AbortSignal) {
  const request = new AbortController();
  const cancel = () => request.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) request.abort();
  const timeout = window.setTimeout(cancel, 15000);
  try {
    const response = await fetch(url, { signal: request.signal, headers: { Accept: "application/geo+json" } });
    if (!response.ok) throw new Error("Weather service unavailable");
    return await response.json();
  } finally { window.clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }
}
const testPlace: Place = { name: "Hood River, OR · 97031", latitude: 45.6711, longitude: -121.5391 };
const testUser = "85fa9666-f688-4ad0-8387-e72f5f25ebd2";
export function weatherScene(description: string) {
  if (/snow|sleet|ice|flurr/i.test(description)) return "snow";
  if (/thunder|storm/i.test(description)) return "storm";
  if (/rain|showers|drizzle/i.test(description)) return "rain";
  if (/fog|haze|mist/i.test(description)) return "fog";
  if (/cloud|overcast/i.test(description)) return "cloudy";
  return "clear";
}

export function WeatherBackdrop({ userId }: { userId: string }) {
  const storageKey = `fasttract-weather-v1-${userId}`;
  const [place, setPlace] = useState<Place | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (typeof saved?.name === "string" && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) return saved;
    } catch { /* Ignore an invalid saved preference. */ }
    return userId === testUser ? testPlace : null;
  });
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(() => localStorage.getItem(`${storageKey}-paused`) === "true");
  const [editing, setEditing] = useState(false);
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!place) return;
    const controller = new AbortController();
    const json = (url: string) => requestJson(url, controller.signal);
    const refresh = async () => {
      try {
        const point = await json(`https://api.weather.gov/points/${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`);
        const url = point.properties?.forecastHourly;
        if (typeof url !== "string" || !url.startsWith("https://api.weather.gov/")) throw new Error("No forecast for this location");
        const result = await json(url);
        const periods = result.properties?.periods?.filter((period: Period) => new Date(period.endTime).getTime() > Date.now()).slice(0, 6);
        if (!periods?.length) throw new Error("Forecast temporarily unavailable");
        if (!controller.signal.aborted) { setForecast({ periods, updated: Date.now(), timeZone: point.properties.timeZone }); setError(""); }
      } catch {
        if (!controller.signal.aborted) setError("Forecast unavailable — retrying automatically");
      }
    };
    setForecast(null); setError("");
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [place]);

  const chooseZip = async () => {
    if (!/^\d{5}$/.test(zip)) { setLocationError("Enter a five-digit US ZIP code."); return; }
    setSearching(true); setLocationError("");
    try {
      const result = await requestJson(`https://api.zippopotam.us/us/${zip}`);
      const found = result.places?.[0];
      if (!found) throw new Error();
      const selected = { name: `${found["place name"]}, ${found["state abbreviation"]} · ${zip}`, latitude: Number(found.latitude), longitude: Number(found.longitude) };
      localStorage.setItem(storageKey, JSON.stringify(selected));
      setPlace(selected); setEditing(false);
    } catch { setLocationError("Couldn’t find that ZIP code. Please try again."); }
    finally { setSearching(false); }
  };

  const current = forecast?.periods.find(period => new Date(period.endTime).getTime() > Date.now());
  const scene = current ? weatherScene(current.shortForecast) : "neutral";
  const night = current && !current.isDaytime;
  return <>
    <div aria-hidden="true" className={`weather-landscape weather-${scene} ${night ? "weather-night" : ""} ${paused ? "weather-paused" : ""}`}>
      <div className="weather-orb" /><div className="weather-stars" />
      <div className="weather-cloud cloud-one" /><div className="weather-cloud cloud-two" /><div className="weather-cloud cloud-three" />
      <svg className="weather-mountains" viewBox="0 0 1600 700" preserveAspectRatio="none"><path fill="#73908e" d="M0 480 220 270 350 380 650 60 930 375 1100 210 1330 390 1600 170V700H0Z"/><path fill="#e1e8e5" opacity=".8" d="m650 60-115 170 72-24 42 30 40-42 59 36Z"/><path fill="#456e66" d="M0 570 260 440 450 560 760 350 1060 580 1390 390 1600 540V700H0Z"/><path fill="#254f43" d="M0 630 300 580 590 650 930 530 1200 620 1600 550V700H0Z"/></svg>
      <div className="weather-river" />
      {["rain", "storm", "snow"].includes(scene) && <div className="weather-particles">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 100}%`, animationDelay: `${-(index % 11) * .4}s`, animationDuration: `${scene === "snow" ? 7 + index % 5 : .7 + index % 4 * .12}s` } as CSSProperties} />)}</div>}
      {scene === "fog" && <div className="weather-fog" />}
    </div>
    <section className="weather-forecast-bar" aria-label="Local weather forecast">
      <CloudSun size={21} aria-hidden="true" />
      <button className="weather-location" onClick={() => setEditing(true)}><span><MapPin size={12} />{place?.name || "Choose your weather location"}</span><strong>{current ? `${current.temperature}°${current.temperatureUnit} · ${current.shortForecast}` : place ? error || "Loading local forecast…" : "Set your local forecast"}</strong></button>
      <div className="weather-upcoming">{forecast?.periods.slice(1, 4).map(period => <span key={period.startTime}><small>{new Date(period.startTime).toLocaleTimeString([], { hour: "numeric", timeZone: forecast.timeZone })}</small><b>{period.temperature}°</b></span>)}</div>
      <div className="weather-source"><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">National Weather Service</a><small>{error ? "Last forecast · refresh pending" : forecast ? `Updated ${new Date(forecast.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · hourly forecast` : "Refreshes every 30 minutes"}</small></div>
      <button className="weather-motion" aria-label={paused ? "Play weather animation" : "Pause weather animation"} onClick={() => { setPaused(value => !value); localStorage.setItem(`${storageKey}-paused`, String(!paused)); }}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
    </section>
    {editing && <section className="weather-location-editor" aria-label="Weather location settings"><div className="flex items-center justify-between"><strong>Your weather location</strong><button aria-label="Close weather settings" onClick={() => setEditing(false)}><X size={16} /></button></div><p>Saved for your account on this browser. Your ZIP code is sent to Zippopotam.us to find the city, then the National Weather Service supplies the forecast.</p><label htmlFor="weather-zip">US ZIP code</label><input id="weather-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} onChange={event => setZip(event.target.value)} placeholder="97031" onKeyDown={event => { if (event.key === "Enter") void chooseZip(); }} />{locationError && <p role="alert">{locationError}</p>}<button className="weather-location-save" onClick={() => void chooseZip()} disabled={searching}>{searching ? "Finding city…" : "Use this location"}</button></section>}
  </>;
}
