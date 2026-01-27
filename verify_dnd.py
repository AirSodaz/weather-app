import json
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    mock_london_response = {
        "weather": [{"description": "Cloudy", "icon": "04d"}],
        "main": {"temp": 15, "humidity": 60, "pressure": 1012, "feels_like": 14},
        "wind": {"speed": 5},
        "sys": {"sunrise": 1600000000, "sunset": 1600050000},
        "visibility": 10000,
        "name": "London",
        "coord": {"lat": 51.5, "lon": -0.12},
        "dt": 1600020000
    }

    mock_paris_response = {
        "weather": [{"description": "Sunny", "icon": "01d"}],
        "main": {"temp": 18, "humidity": 50, "pressure": 1015, "feels_like": 18},
        "wind": {"speed": 3},
        "sys": {"sunrise": 1600000000, "sunset": 1600050000},
        "visibility": 10000,
        "name": "Paris",
        "coord": {"lat": 48.85, "lon": 2.35},
        "dt": 1600020000
    }

    def handle_api(route):
        url = route.request.url
        # print(f"Intercepted: {url}")
        if "openweathermap" in url:
            if "/weather" in url:
                if "London" in url or "lat=51.5" in url:
                    route.fulfill(json=mock_london_response)
                elif "Paris" in url or "lat=48.85" in url:
                    route.fulfill(json=mock_paris_response)
                else:
                    route.fulfill(status=404)
            elif "/forecast" in url:
                route.fulfill(json={"list": [], "city": {"coord": {"lat": 0, "lon": 0}}})
            elif "/air_pollution" in url:
                route.fulfill(json={"list": [{"main": {"aqi": 1}, "components": {"pm2_5": 10, "pm10": 10, "o3": 10, "no2": 10}}]})
            else:
                 route.fulfill(json={})
        else:
            route.continue_()

    # Intercept API calls
    page.route("**/*", handle_api)

    # Navigate to app
    print("Navigating...")
    page.goto("http://localhost:1420")

    # Wait for load
    page.wait_for_selector("#root")

    # Inject localStorage settings and saved cities
    print("Injecting settings...")
    page.evaluate("""
        () => {
            localStorage.setItem('savedCities', JSON.stringify([
                {name: 'London', source: 'openweathermap', lat: 51.5, lon: -0.12},
                {name: 'Paris', source: 'openweathermap', lat: 48.85, lon: 2.35}
            ]));
            localStorage.setItem('settings', JSON.stringify({
                source: 'openweathermap',
                apiKeys: {openweathermap: 'mock_key'},
                autoRefreshInterval: 0
            }));
            // Clear weatherCache to force fetch (which hits our mock)
            localStorage.removeItem('weatherCache');
        }
    """)

    # Reload
    print("Reloading...")
    page.reload()

    # Wait for cards to appear
    print("Waiting for London...")
    try:
        page.wait_for_selector("text=London", timeout=10000)
        print("London found.")
        page.wait_for_selector("text=Paris", timeout=10000)
        print("Paris found.")
    except Exception as e:
        print(f"Timeout waiting for cities: {e}")
        page.screenshot(path="/home/jules/verification/debug_fail_load.png")
        browser.close()
        return

    # Take initial screenshot
    page.screenshot(path="/home/jules/verification/before_drag.png")

    # Drag London to Paris
    print("Starting drag...")
    london_card = page.locator(".glass-card").filter(has_text="London").first
    paris_card = page.locator(".glass-card").filter(has_text="Paris").first

    # Ensure they are visible and stable
    london_card.scroll_into_view_if_needed()
    paris_card.scroll_into_view_if_needed()
    page.wait_for_timeout(1000)

    # Perform Drag
    london_card.drag_to(paris_card)

    # Wait for animation/state update
    page.wait_for_timeout(2000)

    # Verify order
    cities = page.locator(".glass-card h2").all_inner_texts()
    print("Cities order:", cities)

    # Expect Paris, London
    if cities == ["Paris", "London"]:
        print("Success: Order changed correctly")
        page.screenshot(path="/home/jules/verification/verification.png")
    else:
        print("Failure: Order did not change as expected")
        page.screenshot(path="/home/jules/verification/failed_drag.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
