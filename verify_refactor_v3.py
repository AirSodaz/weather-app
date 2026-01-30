import re
from playwright.sync_api import sync_playwright, expect
import json
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            permissions=['geolocation'],
            geolocation={'latitude': 40.7128, 'longitude': -74.0060},
            locale='en-US'
        )
        page = context.new_page()

        # 1. Load the page first to initialize storage wrapper if needed
        print("Loading page first time...")
        page.goto("http://localhost:1420", timeout=30000)
        page.wait_for_load_state("networkidle")

        # 2. Inject Saved Cities into localStorage
        print("Injecting localStorage...")
        saved_cities = [
            {"name": "MockCity", "lat": 40.7128, "lon": -74.0060, "source": "openweathermap"}
        ]

        settings = {
            "source": "openweathermap",
            "apiKeys": {
                "openweathermap": "mock_key",
                "weatherapi": "",
                "qweather": "",
                "custom": ""
            },
            "autoRefreshInterval": 15
        }

        page.evaluate(f"""() => {{
            localStorage.setItem('savedCities', '{json.dumps(saved_cities)}');
            localStorage.setItem('settings', '{json.dumps(settings)}');
            console.log('Injected savedCities and settings');
        }}""")

        # 3. Setup API Mocking
        print("Setting up API mocks...")

        # Mock Current Weather
        def handle_weather(route):
            print(f"Intercepted weather request: {route.request.url}")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({
                    "name": "MockCity",
                    "coord": {"lat": 40.7128, "lon": -74.0060},
                    "weather": [{"main": "Clear", "description": "clear sky", "icon": "01d"}],
                    "main": {
                        "temp": 25.5,
                        "feels_like": 26.0,
                        "temp_min": 22.0,
                        "temp_max": 28.0,
                        "pressure": 1012,
                        "humidity": 40
                    },
                    "wind": {"speed": 5.0, "deg": 180},
                    "sys": {
                        "sunrise": 1625212800,  # 08:00 UTC
                        "sunset": 1625266800    # 23:00 UTC
                    },
                    "visibility": 10000,
                    "dt": 1625240000
                })
            )

        # Mock Forecast
        def handle_forecast(route):
            print(f"Intercepted forecast request: {route.request.url}")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({
                    "list": [
                        {
                            "dt": 1625245000,
                            "main": {"temp": 24.0, "temp_min": 24.0, "temp_max": 24.0, "humidity": 45},
                            "weather": [{"main": "Clouds", "description": "few clouds", "icon": "02d"}],
                            "wind": {"speed": 4.0},
                            "dt_txt": "2021-07-02 15:00:00"
                        }
                    ]
                })
            )

        # Mock Air Pollution
        def handle_air(route):
            print(f"Intercepted air request: {route.request.url}")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({
                    "list": [{
                        "main": {"aqi": 1},
                        "components": {"co": 200, "no": 0, "no2": 0, "o3": 0, "so2": 0, "pm2_5": 0, "pm10": 0, "nh3": 0},
                        "dt": 1625240000
                    }]
                })
            )

        # Use specific patterns to avoid intercepting assets/modules
        page.route("**/data/2.5/weather*", handle_weather)
        page.route("**/data/2.5/forecast*", handle_forecast)
        page.route("**/data/2.5/air_pollution*", handle_air)

        # 4. Reload to apply injection
        print("Reloading page...")
        page.reload()

        # 5. Wait for the city card
        print("Waiting for MockCity card...")
        page.wait_for_selector("text=MockCity", timeout=10000)
        print("Found MockCity card!")

        # Verify Temp on Card (Round 25.5 -> 26)
        page.wait_for_selector("text=26°", timeout=5000)
        print("Found correct temperature 26° on card.")

        # 6. Open Detail View
        print("Clicking MockCity card...")
        page.click("text=MockCity")

        # 7. Check formatting (wait for detail view)
        print("Waiting for detail view...")
        # Check for Detailed Temp or Label
        try:
            # Wait for detail specific element (e.g. text containing 'Humidity' or 'Wind')
            page.wait_for_selector("text=Humidity", timeout=5000)

            # Take screenshot of detail view to verify Sunrise/Sunset
            # Ensure directory exists
            if not os.path.exists("verification"):
                os.makedirs("verification")
            page.screenshot(path="verification/verification.png")
            print("Verification screenshot saved.")
        except Exception as e:
            print(f"Error in detail view: {e}")
            if not os.path.exists("verification"):
                os.makedirs("verification")
            page.screenshot(path="verification/verification_error.png")
            raise e

        browser.close()

if __name__ == "__main__":
    run()
