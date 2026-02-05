from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        print("Navigating to app...")
        page.goto("http://localhost:1420/")

        # Wait for something significant.
        # The search bar should be visible.
        # Based on SearchBar.tsx, it might have a placeholder or role.
        # Let's assume there is an input for search.
        print("Waiting for search input...")
        try:
            expect(page.get_by_placeholder("Search city...")).to_be_visible(timeout=10000)
        except:
            # Fallback if placeholder is different (localized)
            # Try waiting for an input type text
            page.wait_for_selector("input[type='text']")

        print("Taking screenshot...")
        page.screenshot(path="verification/dashboard.png")

        browser.close()
        print("Done.")

if __name__ == "__main__":
    run()
