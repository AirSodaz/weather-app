import json
import time
import re
from playwright.sync_api import sync_playwright, expect

def run(page):
    # 1. Arrange: Go to the app
    page.goto("http://localhost:1420/")

    # Inject settings with fake API key so the app tries to search
    settings = {
        "source": "openweathermap",
        "apiKeys": {
            "openweathermap": "fake_key"
        }
    }
    page.evaluate("(settings) => localStorage.setItem('settings', JSON.stringify(settings))", settings)
    page.reload()

    # Mock the API response for search
    # This ensures we get specific results and don't need a real API key
    mock_response = [
        {"name": "New York", "lat": 40.71, "lon": -74.00, "country": "US", "state": "New York"},
        {"name": "New London", "lat": 41.35, "lon": -72.09, "country": "US", "state": "Connecticut"},
        {"name": "Newcastle", "lat": 54.97, "lon": -1.61, "country": "GB", "state": "Newcastle upon Tyne"}
    ]

    # Intercept OpenWeatherMap geo API
    page.route("**/geo/1.0/direct*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps(mock_response)
    ))

    # 2. Act: Search for a city
    # Find the search input. It has role="search" on the form, but input is inside.
    # The input has aria-label="Search city" or placeholder="Add a city..."
    search_input = page.get_by_placeholder("Add a city...")
    expect(search_input).to_be_visible()

    search_input.fill("New")

    # Wait for suggestions to appear
    suggestions = page.locator("#search-suggestions")
    expect(suggestions).to_be_visible(timeout=5000)

    # 3. Assert & Verify Keyboard Navigation
    # Press ArrowDown to select first item
    search_input.press("ArrowDown")

    # Verify the first item is selected (aria-selected="true")
    first_option = suggestions.get_by_role("option").first
    expect(first_option).to_have_attribute("aria-selected", "true")

    # Also verify it has the highlighted background class (bg-white/10)
    # Note: class checks can be brittle if multiple classes, but let's check if it contains it
    expect(first_option).to_have_class(re.compile(r"bg-white/10"))

    # Press ArrowDown again to select second item
    search_input.press("ArrowDown")
    second_option = suggestions.get_by_role("option").nth(1)
    expect(second_option).to_have_attribute("aria-selected", "true")
    expect(first_option).to_have_attribute("aria-selected", "false")

    # Press ArrowUp to go back to first
    search_input.press("ArrowUp")
    expect(first_option).to_have_attribute("aria-selected", "true")

    # 4. Screenshot
    page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
            raise e
        finally:
            browser.close()
