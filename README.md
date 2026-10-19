# Prayer Breaks — VS Code Extension for Muslim Developers

Mindful Islamic prayer time reminders, live status bar countdown, and prayer break timer built right into Visual Studio Code.

## Features

- **Live Status Bar Countdown**: Displays the upcoming obligatory prayer and remaining time (e.g., `Asr in 42m`) in your VS Code status bar.
- **Rich Schedule Tooltip**: Hover over the status bar item to view today's complete prayer schedule (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) with Arabic names, Hijri date, and quick action links.
- **Offline Astronomical Calculation**: Uses the trusted [`adhan`](https://github.com/batoulapps/adhan-js) library for accurate offline prayer time calculation—no internet required after location setup.
- **Zero-Friction Location Setup**:
  - Automatically detects your city, coordinates, and regional calculation method via IP geolocation on first run.
  - Pick from 30+ major global cities or enter exact Latitude/Longitude coordinates manually.
- **Smart Notifications & Break Timer**:
  - **Pre-Prayer Heads-Up**: Configurable reminder (default: 10 minutes before prayer) so you can commit your code and wrap up your current thought.
  - **On-Time Prayer Alert**: Notification when prayer time arrives with one-click **Start Break** and **Snooze** buttons.
  - **Active Break Timer**: Shows `On Break (Asr: 14:32)` in the status bar while you step away to pray.

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) or click the status bar item:

- `Prayer Breaks: Show Schedule & Actions` (`prayerBreaks.showMenu`)
- `Prayer Breaks: Select City or Set Coordinates` (`prayerBreaks.selectCity`)
- `Prayer Breaks: Auto-Detect Location (IP)` (`prayerBreaks.detectLocation`)
- `Prayer Breaks: Select Calculation Method` (`prayerBreaks.selectCalculationMethod`)
- `Prayer Breaks: Select Asr Juristic Method (Madhab)` (`prayerBreaks.selectMadhab`)
- `Prayer Breaks: Start Prayer Break` (`prayerBreaks.startBreak`)
- `Prayer Breaks: End Current Break` (`prayerBreaks.endBreak`)
- `Prayer Breaks: Snooze Reminder (5 min)` (`prayerBreaks.snooze`)

## Extension Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `prayerBreaks.latitude` | `null` | Latitude of your location (auto-detected on first run if `null`). |
| `prayerBreaks.longitude` | `null` | Longitude of your location (auto-detected on first run if `null`). |
| `prayerBreaks.cityName` | `""` | Display name for your city/location. |
| `prayerBreaks.calculationMethod` | `"MuslimWorldLeague"` | Calculation authority (`UmmAlQura`, `Egyptian`, `Karachi`, `NorthAmerica`, `Dubai`, `Qatar`, `Kuwait`, `Turkey`, `Singapore`, `MoonsightingCommittee`, `Tehran`, `MuslimWorldLeague`). |
| `prayerBreaks.madhab` | `"Shafi"` | Asr juristic method: `"Shafi"` (Standard) or `"Hanafi"`. |
| `prayerBreaks.preNotificationMinutes` | `10` | Minutes before prayer time to show a heads-up alert (`0` to disable). |
| `prayerBreaks.breakDurationMinutes` | `15` | Default duration in minutes for a prayer break timer. |
| `prayerBreaks.snoozeMinutes` | `5` | Minutes to snooze a prayer reminder. |
| `prayerBreaks.use24HourFormat` | `false` | Display times in 24-hour format. |
| `prayerBreaks.statusBarAlignment` | `"Right"` | Status bar alignment (`"Left"` or `"Right"`). |

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile TypeScript:
   ```bash
   npm run compile
   ```
3. Press **`F5`** in VS Code to launch the **Extension Development Host** window and test the extension live.
