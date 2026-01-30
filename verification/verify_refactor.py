import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock API responses
        def handle_weather(route):
            print("Intercepted Weather API")
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"coord":{"lon":-74.01,"lat":40.71},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01d"}],"base":"stations","main":{"temp":25.5,"feels_like":26.0,"temp_min":24.0,"temp_max":27.0,"pressure":1013,"humidity":50},"visibility":10000,"wind":{"speed":5.0,"deg":0},"clouds":{"all":0},"dt":1625212800,"sys":{"type":1,"id":1,"country":"US","sunrise":1625212800,"sunset":1625266800},"timezone":-14400,"id":5128581,"name":"MockCity","cod":200}'
            )

        def handle_forecast(route):
            print("Intercepted Forecast API")
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"cod":"200","message":0,"cnt":40,"list":[{"dt":1625212800,"main":{"temp":25.5,"feels_like":26.0,"temp_min":24.0,"temp_max":27.0,"pressure":1013,"sea_level":1013,"grnd_level":1010,"humidity":50,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01d"}],"clouds":{"all":0},"wind":{"speed":5.0,"deg":0,"gust":7.0},"visibility":10000,"pop":0,"sys":{"pod":"d"},"dt_txt":"2021-07-02 08:00:00"}],"city":{"id":5128581,"name":"MockCity","coord":{"lat":40.71,"lon":-74.01},"country":"US","population":1000000,"timezone":-14400,"sunrise":1625212800,"sunset":1625266800}}'
            )

        def handle_air(route):
            print("Intercepted Air API")
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"coord":[50,50],"list":[{"main":{"aqi":1},"components":{"co":201.94053649902344,"no":0.01877197064459324,"no2":0.7711350917816162,"o3":68.66455078125,"so2":0.6484769582748413,"pm2_5":0.5,"pm10":0.5404287576675415,"nh3":0.12369127571582794},"dt":1625212800}]}'
            )

        page.route("**/data/2.5/weather*", handle_weather)
        page.route("**/data/2.5/forecast*", handle_forecast)
        page.route("**/data/2.5/air_pollution*", handle_air)

        # Inject settings
        page.goto("http://localhost:1420")

        page.evaluate("""() => {
            localStorage.setItem('savedCities', JSON.stringify(['MockCity']));
            localStorage.setItem('weather_settings', JSON.stringify({
                source: 'openweathermap',
                apiKeys: { openweathermap: 'mock_key' },
                autoRefreshInterval: 15,
                theme: 'auto',
                language: 'en'
            }));
        }""")

        page.reload()

        # Wait for card
        print("Waiting for weather card...")
        try:
            page.wait_for_selector("text=MockCity", timeout=10000)
            print("Found MockCity card!")

            # Check temp
            content = page.content()
            if "26°" in content: # 25.5 rounds to 26
                print("Found correct temperature 26° on card.")
            else:
                print("Temperature verification failed.")

            # Click to see details
            page.click("text=MockCity")
            time.sleep(2) # Wait for animation

            page.screenshot(path="verification/verification.png")
            print("Verification screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")

        browser.close()

if __name__ == "__main__":
    run()
