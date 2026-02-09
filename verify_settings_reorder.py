
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    print("Navigating to app...")
    page.goto("http://localhost:1420/")

    # Wait for the page to load
    # Use input placeholder "Add a city..."
    try:
        page.wait_for_selector('input[placeholder="Add a city..."]', timeout=20000)
    except Exception as e:
        print(f"Error waiting for search bar: {e}")
        page.screenshot(path="verification_timeout.png")
        print("Screenshot saved to verification_timeout.png")
        browser.close()
        return

    print("App loaded.")

    print("Opening menu...")
    try:
        page.click('button[aria-label="Main menu"]')
    except Exception as e:
        print(f"Error clicking menu: {e}")
        page.screenshot(path="verification_menu_fail.png")
        browser.close()
        return

    # Open Settings
    print("Clicking Settings...")
    try:
        # Wait for menu animation
        page.wait_for_timeout(500)
        page.click('text=Settings')
    except Exception as e:
        print(f"Error clicking Settings: {e}")
        page.screenshot(path="verification_settings_click_fail.png")
        browser.close()
        return

    # Wait for Settings Modal
    print("Waiting for Settings modal...")
    try:
        page.wait_for_selector('text=Detail View', timeout=5000)
    except Exception as e:
        print(f"Error waiting for modal: {e}")
        page.screenshot(path="verification_modal_fail.png")
        browser.close()
        return

    print("Settings modal opened.")

    # Find the Detail View sections container
    # It contains "Detail View" label.
    # The sections are in a div following the label.
    # I'll look for the buttons I added.

    # Check for buttons
    print("Checking for Up/Down buttons...")
    up_buttons = page.locator('button[aria-label*="up"]')
    down_buttons = page.locator('button[aria-label*="down"]')

    count_up = up_buttons.count()
    print(f"Found {count_up} Up buttons.")

    if count_up == 0:
        print("No Up buttons found!")
        page.screenshot(path="verification_no_buttons.png")
        browser.close()
        return

    # Get first section
    # The buttons are aria-label="Move [Section] up"
    # Let's get the first button's label to identify the section.
    first_up_btn = up_buttons.nth(0)
    first_label = first_up_btn.get_attribute("aria-label")
    print(f"First Up button label: {first_label}")

    # Check disabled state
    is_disabled = first_up_btn.is_disabled()
    print(f"First Up button disabled: {is_disabled}")

    if not is_disabled:
        print("WARNING: First Up button should be disabled!")

    # Find the corresponding Down button
    # It should be the first Down button
    first_down_btn = down_buttons.nth(0)
    down_label = first_down_btn.get_attribute("aria-label")
    print(f"First Down button label: {down_label}")

    # Click Down on first item
    print("Clicking Down button on first item...")
    first_down_btn.click()

    # Wait for reorder
    page.wait_for_timeout(1000)

    # Verify new order
    # After moving down, the first Up button should belong to the NEW first item (which was second).
    # And it should be disabled.

    new_first_up_btn = page.locator('button[aria-label*="up"]').nth(0)
    new_first_label = new_first_up_btn.get_attribute("aria-label")
    print(f"New first Up button label: {new_first_label}")

    if new_first_label != first_label:
        print("SUCCESS: Order changed.")
    else:
        print("FAILURE: Order did not change.")

    # Take screenshot
    page.screenshot(path="verification_final.png")
    print("Screenshot saved to verification_final.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
