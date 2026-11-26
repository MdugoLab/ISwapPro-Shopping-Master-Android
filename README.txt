ISWAPPRO SHOPPING MASTER V29
Universal purchasing and shopping manager.

OPEN ON ANDROID
1. Export a JSON backup from your existing app before replacing anything.
2. Extract this ZIP using your phone's file manager.
3. Open the extracted folder.
4. Tap index.html and choose Chrome.
5. Your app data remains in the same browser storage key when opened in the same browser profile. If data does not appear, import your JSON backup from Insights & Reports.

BARCODE SCANNING
- Tap Scan barcode in the shopping item form or inventory form.
- V23 uses a delegated button handler so taps on the button and its contents are handled.
- The app checks camera API availability, secure context and BarcodeDetector support, and reports the reason if scanning cannot start.
- Allow camera permission when Chrome asks.
- For reliable live camera scanning, serve the extracted app from HTTPS or localhost. Chrome/Android may block camera access from a content:// local file.
- If live scanning is unavailable, type or paste the barcode into the barcode field and save the item.

PURCHASE LISTS
- General Shopping: groceries, household items, clothing, electronics, personal care, education/office and other purchases.
- Business Items: products, equipment, packaging, stationery and other business-related purchases.
- Tools & Project Items: building materials, electrical/plumbing supplies, tools and project supplies.
Lists stay separate. Changing tabs does not archive a list. Checkout archives only collected items; unchecked items remain active.

QUANTITY CONTROLS
Use + and − directly on each shopping-list row. Quantity updates are saved immediately. Whole units increment by 1; measured units increment by 0.1.

PROJECT STRUCTURE
index.html — Android-compatible self-contained app.
css/styles.css — matching editable stylesheet source.
js/app.js — matching editable JavaScript source.
assets/ — icons and images.
documentation/ — project and QA notes.

DATA & PRIVACY
Data is stored locally in this browser. No cloud sync or online payment is included. Export a JSON backup regularly. Keep the previous app folder until you verify the new version.


V25 UNIVERSAL PURCHASING UPDATE
- General Shopping, Business Items, and Tools & Project Items are available as separate lists.
- Category selection is restored in Add Item, Inventory and Insights.
- Business administration modules remain outside this application.
- V22 mobile layout and existing barcode scanner logic are preserved.

V24 BARCODE SCANNER NOTES
- The scan button now displays a specific diagnostic when camera access or barcode decoding is unavailable.
- Live scanning requires HTTPS or localhost, camera permission, and Chrome BarcodeDetector support for product barcode formats.
- Opening index.html from Android content:// storage may prevent camera access.
- If the browser reports that BarcodeDetector is unavailable, use manual barcode entry; this build does not download a decoder and therefore remains usable offline.
- For live scanning, publish this folder to a trusted HTTPS static host (for example GitHub Pages) and open the HTTPS address in Chrome.


V26 BARCODE SCANNER UPGRADE
- Requests a higher-resolution rear-camera stream (up to 1920x1080 where supported).
- Requests continuous autofocus when the browser exposes that capability.
- Adds a flashlight toggle when the camera supports torch control.
- Improves on-screen scanning guidance and keeps manual barcode entry available.
- Camera controls vary by Android device and browser; autofocus/torch are best-effort capabilities.
- Barcode decoding still depends on the browser BarcodeDetector API and supported formats.


V27 — BARCODE RECOGNITION & PRODUCT LOOKUP
- Retains the V26 camera/scanner implementation.
- On successful scan, attempts an optional product lookup using the public Open Food Facts catalogue.
- If a product is found, its name is suggested only when the item-name field is empty. Pack size is added to shopping notes when available.
- If the catalogue has no match or is offline, the barcode remains captured and manual entry remains available.
- Checks barcode duplicates across shopping items and purchase inventory before saving; the user can cancel or explicitly confirm a duplicate.
- Product lookup requires an internet connection and catalogue coverage; it is not guaranteed for every barcode or product category.


V29 CAMERA AND BARCODE SCANNER UPDATE
- Preserves the native camera aspect ratio instead of forcing a landscape preview.
- Requests continuous autofocus when supported by the device; falls back to single-shot focus when available.
- Shows camera resolution and clearer positioning guidance.
- Adds a zoom slider only when the camera reports hardware zoom support.
- Keeps flashlight support conditional on device capability.
- Barcode recognition still depends on browser BarcodeDetector support and the camera hardware. Test on the live HTTPS GitHub Pages site.


V29 CAMERA UPGRADE
- Requests a more moderate 1280x720 capture profile to reduce the chance of selecting an unnecessarily narrow/high-resolution camera mode. Actual dimensions remain device/browser controlled.
- Starts at the widest zoom level exposed by the camera, including sub-1x ultra-wide zoom when supported.
- Zoom slider displays the selected magnification.
- Keeps the camera preview proportional to the actual video stream and avoids forcing a portrait feed into a landscape viewport.
- Autofocus remains best-effort and depends on the camera and browser.

DEVICE TEST REQUIRED
Camera lens selection, autofocus, optical/digital zoom range and barcode decoding vary by Android device and Chrome version. Test V29 on the published HTTPS site. If the device does not expose zoom below 1x, the app cannot force an ultra-wide lens through standard browser camera controls.
