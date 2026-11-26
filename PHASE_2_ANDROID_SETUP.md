# Phase 2 — Android Project Generation

## Status
The project is prepared for a reproducible Android build. This environment does not have Android SDK/Gradle installed, so the APK cannot be compiled locally here. The included GitHub Actions workflow can build a debug APK in the cloud after the project is uploaded to a GitHub repository.

## Cloud build route (recommended for phone-only development)
1. Create a GitHub repository for this experimental project. Keep the original V29 repository separate.
2. Upload/extract the entire experimental project into the repository.
3. Open the repository's **Actions** tab.
4. Select **Build ISwapPro Shopping Master Android APK**.
5. Press **Run workflow** and confirm.
6. Wait for the workflow to finish successfully.
7. Open the completed workflow run and download the artifact named `ISwapPro-Shopping-Master-V29-debug-apk`.
8. Extract the artifact and install `app-debug.apk` on Android. If Android asks, allow installation from the browser/files app used to open it.

## Local build commands (computer with Android Studio/SDK)
```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```
The APK is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Camera testing checklist
- Install and launch app.
- Open barcode scanner.
- Grant camera permission when prompted.
- Confirm live preview appears.
- Switch front/rear camera if UI supports it; barcode scanning should use rear camera.
- Test autofocus and framing.
- Test zoom and torch controls, noting device-supported features.
- Test scan detection and manual barcode entry fallback.
- Test app restart and saved data.

## Known compatibility risks
- Android WebView may not expose `BarcodeDetector` on every device. If unavailable, a native barcode scanning bridge/library will be needed.
- `getUserMedia`, zoom, torch, and focus constraints are device and WebView dependent.
- This experimental build does not yet add native barcode scanning or custom native camera controls.
- Keep the V29 source/original ZIP unchanged. All changes are experimental.
