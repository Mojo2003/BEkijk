# BEkijk voor Android TV

Volledig Gradle-project (Kotlin + Jetpack Compose for TV) klaar om een APK te bouwen.

## APK bouwen in Android Studio
1. Open de map `android-tv` in **Android Studio**.
2. Laat Gradle synchroniseren (AGP 8.7.3, Kotlin 2.0.21, Compose for TV `1.0.0`).
3. Kies **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

## APK bouwen via terminal
```bash
gradle assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

## Installeren op Android TV / Google TV via ADB
```bash
adb connect <IP-VAN-JE-TV>:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
