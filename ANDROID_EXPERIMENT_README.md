# ISwapPro Shopping Master V29 — Android APK Experiment

**This is a separate experimental copy. The original V29 ZIP is not modified.**

## Audit result
- App is a single-page web application with a large inline script in `www/index.html`.
- `www/js/app.js` is a duplicate standalone script, but `index.html` does not load it. Do not add it as a second script or the app will initialize twice.
- Data is stored in browser `localStorage` using key `iswappro_shopping_cart_v1`.
- Camera scanning uses `navigator.mediaDevices.getUserMedia()` and the native browser `BarcodeDetector` API.
- Rear-camera preference, 1280x720 target, continuous autofocus where supported, hardware zoom (including sub-1x), torch, and scan loop are browser-feature-dependent.
- Barcode scanning currently has no decoder fallback when `BarcodeDetector` is unavailable. Manual barcode entry remains available.
- The service worker cache name is `iswappro-shopping-master-v21` despite the app being V29; this is a stale cache-version issue to correct during the Android/PWA update phase.
- The app calls the Open Food Facts API for product lookup. Internet is needed for that feature; manual entry/local app features should remain usable offline.
- Camera permissions and WebView permission behavior must be tested on the actual Android device. A native barcode-scanning fallback may be needed if Android WebView lacks `BarcodeDetector`.

## Build environment
Use a computer with Node.js LTS, Android Studio, Android SDK, and Java/JDK supported by the installed Android Gradle tooling. The ZIP is a source project—not a prebuilt APK.

## Initial setup
1. Extract this ZIP.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npx cap add android` (only once; creates the Android project).
5. Run `npx cap sync android`.
6. Open the project with `npx cap open android`.
7. In Android Studio, allow SDK installation if prompted and build a debug APK.

## Android camera permission
After Android is generated, inspect `android/app/src/main/AndroidManifest.xml`. Add these permissions above `<application>` if missing:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

The camera permission also must be granted by the Android user at runtime. Verify that the WebView camera request is actually granted; a manifest declaration alone is not sufficient. If the WebView does not expose the camera to `getUserMedia`, we will add a native permission bridge/plugin or use a native scanner plugin in a separate milestone.

## Test checklist
- [ ] App opens without a blank screen/crash
- [ ] All tabs/navigation work
- [ ] Create/edit/delete list items
- [ ] Data remains after app is closed and reopened
- [ ] Export/import backup works
- [ ] Camera permission prompt appears
- [ ] Rear camera opens and preview is visible
- [ ] BarcodeDetector exists in Android WebView
- [ ] Barcode scan successfully reads an EAN/UPC
- [ ] Focus/zoom/torch are gracefully hidden or supported
- [ ] Scanner stops when dialog closes
- [ ] Product lookup works online
- [ ] App works offline for local functions
- [ ] Layout fits portrait phone and keyboard does not obscure controls

## Known cautions
- Do not overwrite the original V29 project.
- Do not treat a successful web preview as proof the APK camera works.
- `BarcodeDetector` support varies by Android System WebView version/device.
- The app's existing `localStorage` data is browser-origin scoped; it will not automatically import data from the Chrome/PWA instance into the APK. Use the app's JSON export/import to transfer data during testing.
