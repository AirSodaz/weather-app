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

        page.route("**/forecast.json*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(forecast_response)
        ))

        page.route("**/history.json*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({})
        ))

        # --- Test 1: 24h Format (Default) ---
        print("\n--- Testing 24h Format ---")

        # Inject Settings (WeatherAPI Source, 24h, startup Home)
        settings_24h = {
            "source": "weatherapi",
            "apiKeys": {"weatherapi": "mock-key"},
            "timeFormat": "24h",
            "autoRefreshInterval": 15,
            "startupView": "home"
        }

        page.goto("http://localhost:1420")
        page.evaluate(f"window.localStorage.setItem('settings', JSON.stringify({json.dumps(settings_24h)}))")
        page.evaluate(f"window.localStorage.setItem('savedCities', JSON.stringify([{json.dumps('TestCity')}]))")
        page.reload()

        try:
            page.wait_for_selector("text=TestCity", timeout=5000)
            page.click("text=TestCity")
            time.sleep(1) # Wait for animation/render

            # Check for 24h sunrise/sunset
            sunrise_24h = page.is_visible("text=06:15")
            sunset_24h = page.is_visible("text=18:45")

            print(f"24h Sunrise (06:15) found: {sunrise_24h}")
            print(f"24h Sunset (18:45) found: {sunset_24h}")

            if not sunrise_24h or not sunset_24h:
                page.screenshot(path="verification/fail_24h.png")
                raise Exception("Failed to display 24h format")

            # Check for "15:00" (3 PM) which should be in the sampled list
            hour_24h = page.is_visible("text=15:00")
            print(f"24h Hour (15:00) found: {hour_24h}")
            if not hour_24h:
                 # Check content if hidden
                 if "15:00" in page.content(): print("15:00 found in content (hidden)")

        except Exception as e:
            print(f"Error in 24h test: {e}")
            raise

        # --- Test 2: 12h Format ---
        print("\n--- Testing 12h Format ---")

        # Force startup view to home to ensure clean state click
        settings_12h = {
            "source": "weatherapi",
            "apiKeys": {"weatherapi": "mock-key"},
            "timeFormat": "12h",
            "autoRefreshInterval": 15,
            "startupView": "home"
        }
        page.evaluate(f"window.localStorage.setItem('settings', JSON.stringify({json.dumps(settings_12h)}))")
        page.reload()

        try:
            # Wait for list to load
            page.wait_for_selector("text=TestCity", timeout=5000)

            # Ensure we are not covered by detail view (shouldn't be due to startupView: home)
            if page.is_visible("text=Hourly Forecast"):
                 print("Warning: Detail view seems open unexpectedly.")

            # Click card
            page.click("text=TestCity")
            time.sleep(1)

            # Check for 12h sunrise/sunset
            sunrise_12h = page.is_visible("text=6:15 AM")
            sunset_12h = page.is_visible("text=6:45 PM") # 18:45 -> 6:45 PM

            print(f"12h Sunrise (6:15 AM) found: {sunrise_12h}")
            print(f"12h Sunset (6:45 PM) found: {sunset_12h}")

            if not sunrise_12h or not sunset_12h:
                page.screenshot(path="verification/fail_12h.png")
                content = page.content()
                if "06:15" in content: print("Found 06:15 instead (Fail)")
                raise Exception("Failed to display 12h format")

             # Check for "3:00 PM" (15:00)
            hour_12h = page.is_visible("text=3:00 PM")
            print(f"12h Hour (3:00 PM) found: {hour_12h}")

        except Exception as e:
            print(f"Error in 12h test: {e}")
            raise

        browser.close()

if __name__ == "__main__":
    run()
