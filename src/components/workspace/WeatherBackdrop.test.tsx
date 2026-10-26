import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeatherBackdrop, weatherScene } from "./WeatherBackdrop";
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
describe("forecast backdrop", () => {
  it("uses the live hourly forecast and keeps the test ZIP separate from other accounts", async () => {
    const fetchWeather = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { forecastHourly: "https://api.weather.gov/gridpoints/PQR/151,103/forecast/hourly", timeZone: "America/Los_Angeles" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { periods: [{ startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(), temperature: 42, temperatureUnit: "F", shortForecast: "Rain", isDaytime: false }] } }) });
    vi.stubGlobal("fetch", fetchWeather);
    const view = render(<WeatherBackdrop userId="85fa9666-f688-4ad0-8387-e72f5f25ebd2" />);
    await waitFor(() => expect(screen.getByText("42°F · Rain")).toBeVisible());
    expect(document.querySelector(".weather-rain.weather-night")).toBeInTheDocument();
    view.unmount();
    render(<WeatherBackdrop userId="another-account" />);
    expect(screen.getByText("Choose your weather location")).toBeVisible();
    expect(fetchWeather).toHaveBeenCalledTimes(2);
  });
  it("selects precipitation scenes without inventing actual weather observations", () => {
    expect(weatherScene("Snow showers")).toBe("snow");
    expect(weatherScene("Thunderstorms")).toBe("storm");
    expect(weatherScene("Areas of fog")).toBe("fog");
    expect(weatherScene("Mostly Clear")).toBe("clear");
  });
});
