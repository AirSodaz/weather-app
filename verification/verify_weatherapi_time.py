import json
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        page.on("requestfailed", lambda req: print(f"FAILED: {req.url} {req.failure}"))

        # Mock WeatherAPI Search
        page.route("**/search.json*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([{
                "id": 123,
                "name": "TestCity",
                "region": "TestRegion",
                "country": "TestCountry",
                "lat": 0,
                "lon": 0,
                "url": "test-city"
            }])
        ))

        # Mock WeatherAPI Forecast
        forecast_response = {
            "location": {
                "name": "TestCity",
                "region": "TestRegion",
                "country": "TestCountry",
                "lat": 0,
                "lon": 0,
                "tz_id": "UTC",
                "localtime_epoch": 1698408000,
                "localtime": "2023-10-27 12:00"
            },
            "current": {
                "temp_c": 20,
                "condition": { "text": "Clear", "icon": "//cdn.weatherapi.com/weather/64x64/day/113.png" },
                "humidity": 50,
                "wind_kph": 10,
                "feelslike_c": 20,
                "pressure_mb": 1000,
                "vis_km": 10,
                "uv": 1,
                "air_quality": { "us-epa-index": 1 }
            },
            "forecast": {
                "forecastday": [
                    {
                        "date": "2023-10-27",
                        "day": {
                            "maxtemp_c": 25,
                            "mintemp_c": 15,
                            "condition": { "text": "Sunny", "icon": "//cdn.weatherapi.com/weather/64x64/day/113.png" }
                        },
                        "astro": {
                            "sunrise": "06:15 AM",
                            "sunset": "06:45 PM"
                        },
                        "hour": []
                    }
                ]
            }
        }

        # Populate hours
        for i in range(24):
            forecast_response["forecast"]["forecastday"][0]["hour"].append({
                "time_epoch": 1698364800 + i * 3600,
                "time": f"2023-10-27 {i:02d}:00",
                "temp_c": 15 + i,
                "condition": { "text": "Clear", "icon": "//cdn.weatherapi.com/weather/64x64/day/113.png" }
            })

        def handle_forecast(route):
            print(f"Intercepted forecast: {route.request.url}")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(forecast_response)
            )

        page.route("**/forecast.json*", handle_forecast)

        # Mock WeatherAPI History
        page.route("**/history.json*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({})
        ))

        # Navigate
        page.goto("http://localhost:1420")

        # Inject Settings (WeatherAPI Source)
        settings = {
            "source": "weatherapi",
            "apiKeys": {
                "weatherapi": "mock-key",
                "openweathermap": "",
                "qweather": "",
                "custom": ""
            },
            "customUrl": "",
            "autoRefreshInterval": 15,
            "qweatherHost": "",
            "theme": "dark"
        }

        page.evaluate(f"window.localStorage.setItem('settings', JSON.stringify({json.dumps(settings)}))")

        # Inject Mock City into Saved Cities so it loads on start
        saved_cities = ["TestCity"]
        page.evaluate(f"window.localStorage.setItem('savedCities', JSON.stringify({json.dumps(saved_cities)}))")

        # Reload to apply settings
        page.reload()

        print("Waiting for TestCity...")
        # Wait for the card to appear
        try:
            page.wait_for_selector("text=TestCity", timeout=10000)
        except Exception:
            page.screenshot(path="verification/error_screenshot.png")
            print("Timeout waiting for TestCity. Saved screenshot.")
            raise

        # Click the card to open details
        page.click("text=TestCity")

        # Wait for details to load
        time.sleep(1)
        page.screenshot(path="verification/verification_weatherapi.png")

        sunrise_found = page.is_visible("text=06:15")
        sunset_found = page.is_visible("text=18:45")

        print(f"Sunrise (06:15) found: {sunrise_found}")
        print(f"Sunset (18:45) found: {sunset_found}")

        if not sunrise_found or not sunset_found:
             am_found = page.is_visible("text=06:15 AM")
             print(f"Old format (06:15 AM) found: {am_found}")
             if am_found:
                 raise Exception("Refactor failed: Still showing AM/PM")

        browser.close()

if __name__ == "__main__":
    run()
