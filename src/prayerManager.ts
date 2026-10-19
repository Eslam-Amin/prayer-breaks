import * as vscode from 'vscode';
import { PrayerCalculator, PrayerScheduleItem } from './prayerCalculator';
import {
  CITY_PRESETS,
  detectLocationViaIP,
  saveLocationToConfig,
  suggestCalculationMethodByCountry
} from './locationService';

interface ActiveBreakState {
  prayerName: string;
  endsAt: Date;
}

interface SnoozeState {
  prayer: PrayerScheduleItem;
  remindAt: Date;
}

export class PrayerBreaksManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private calculator: PrayerCalculator;
  private timer: NodeJS.Timeout | undefined;
  private notifiedKeys = new Set<string>();
  private activeBreak: ActiveBreakState | null = null;
  private snoozeState: SnoozeState | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.calculator = new PrayerCalculator();
    this.statusBarItem = this.createStatusBarItem();

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('prayerBreaks')) {
          if (e.affectsConfiguration('prayerBreaks.statusBarAlignment')) {
            this.statusBarItem.dispose();
            this.statusBarItem = this.createStatusBarItem();
          }
          this.tick();
        }
      })
    );
  }

  private createStatusBarItem(): vscode.StatusBarItem {
    const config = vscode.workspace.getConfiguration('prayerBreaks');
    const alignmentStr = config.get<string>('statusBarAlignment', 'Right');
    const alignment =
      alignmentStr === 'Left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;

    const item = vscode.window.createStatusBarItem(alignment, 100);
    item.command = 'prayerBreaks.showMenu';
    item.show();
    return item;
  }

  public async initialize(): Promise<void> {
    if (!this.calculator.hasCoordinates()) {
      this.statusBarItem.text = '$(location) Prayer Breaks: Detecting...';
      this.statusBarItem.tooltip = 'Detecting your location for prayer times...';
      const detected = await detectLocationViaIP();
      if (detected) {
        const suggestedMethod = suggestCalculationMethodByCountry(detected.countryCode);
        await saveLocationToConfig(
          detected.latitude,
          detected.longitude,
          detected.cityName,
          suggestedMethod
        );
        vscode.window
          .showInformationMessage(
            `🕌 Prayer Breaks location set to ${detected.cityName} (${detected.latitude}, ${detected.longitude}).`,
            'Change Location',
            'Calculation Method'
          )
          .then((choice) => {
            if (choice === 'Change Location') {
              vscode.commands.executeCommand('prayerBreaks.selectCity');
            } else if (choice === 'Calculation Method') {
              vscode.commands.executeCommand('prayerBreaks.selectCalculationMethod');
            }
          });
      } else {
        vscode.window
          .showWarningMessage(
            '🕌 Prayer Breaks: Could not auto-detect your location. Please select your city or coordinates.',
            'Select City'
          )
          .then((choice) => {
            if (choice === 'Select City') {
              vscode.commands.executeCommand('prayerBreaks.selectCity');
            }
          });
      }
    }

    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  public tick(): void {
    const now = new Date();

    // 1. Handle active prayer break countdown
    if (this.activeBreak) {
      const remainingMs = this.activeBreak.endsAt.getTime() - now.getTime();
      if (remainingMs <= 0) {
        const finishedPrayer = this.activeBreak.prayerName;
        this.activeBreak = null;
        vscode.window.showInformationMessage(
          `🕌 ${finishedPrayer} prayer break completed. Taqabbal Allah! Ready to resume coding.`
        );
      } else {
        const timerText = this.calculator.formatExactTimer(remainingMs);
        this.statusBarItem.text = `🕌 On Break (${this.activeBreak.prayerName}: ${timerText})`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        this.statusBarItem.tooltip = this.buildTooltip(now);
        return;
      }
    }

    // 2. Check if location is configured
    if (!this.calculator.hasCoordinates()) {
      this.statusBarItem.text = '🕌 Set Prayer Location';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
      const md = new vscode.MarkdownString(
        '### 🕌 Prayer Breaks\n\nLocation is not configured yet.\n\n[$(location) Select City](command:prayerBreaks.selectCity) | [$(globe) Auto-Detect IP](command:prayerBreaks.detectLocation)'
      );
      md.isTrusted = true;
      md.supportThemeIcons = true;
      this.statusBarItem.tooltip = md;
      return;
    }

    // 3. Check snoozed notification
    if (this.snoozeState && now.getTime() >= this.snoozeState.remindAt.getTime()) {
      const snoozedPrayer = this.snoozeState.prayer;
      this.snoozeState = null;
      this.triggerPrayerTimeNotification(snoozedPrayer, true);
    }

    // 4. Update status bar with next prayer countdown
    const nextInfo = this.calculator.getNextObligatoryPrayer(now);
    if (!nextInfo) {
      this.statusBarItem.text = '🕌 Prayer Breaks';
      return;
    }

    const { prayer, remainingMs } = nextInfo;
    const countdownStr = this.calculator.formatCountdown(remainingMs);
    const config = this.calculator.getConfiguration();
    const preMs = config.preNotificationMinutes * 60 * 1000;

    this.statusBarItem.text = `🕌 ${prayer.name} in ${countdownStr}`;
    if (preMs > 0 && remainingMs <= preMs) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    this.statusBarItem.tooltip = this.buildTooltip(now, prayer);

    // 5. Check notifications against today's schedule
    this.checkNotifications(now);
  }


  private checkNotifications(now: Date): void {
    const schedule = this.calculator.getScheduleForDate(now);
    if (!schedule) {
      return;
    }

    const config = this.calculator.getConfiguration();
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    for (const item of schedule) {
      if (!item.isObligatory) {
        continue;
      }

      const diffMs = item.time.getTime() - now.getTime();

      // Pre-prayer notification: trigger when remaining time is within [preMin - 1min, preMin]
      if (config.preNotificationMinutes > 0) {
        const preTargetMs = config.preNotificationMinutes * 60 * 1000;
        const preKey = `${dateKey}-${item.id}-pre`;
        if (
          diffMs <= preTargetMs &&
          diffMs > preTargetMs - 60 * 1000 &&
          !this.notifiedKeys.has(preKey)
        ) {
          this.notifiedKeys.add(preKey);
          this.triggerPrePrayerNotification(item, config.preNotificationMinutes);
        }
      }

      // Exact prayer-time notification: trigger when remaining time is within [-60s, 0s]
      const onTimeKey = `${dateKey}-${item.id}-ontime`;
      if (diffMs <= 0 && diffMs > -60 * 1000 && !this.notifiedKeys.has(onTimeKey)) {
        this.notifiedKeys.add(onTimeKey);
        this.triggerPrayerTimeNotification(item, false);
      }
    }
  }

  private triggerPrePrayerNotification(prayer: PrayerScheduleItem, minutesBefore: number): void {
    const config = this.calculator.getConfiguration();
    const formattedTime = this.calculator.formatTime(prayer.time);
    const startLabel = `Start Break (${config.breakDurationMinutes}m)`;
    const snoozeLabel = `Snooze (${config.snoozeMinutes}m)`;

    vscode.window
      .showInformationMessage(
        `🕌 ${prayer.name} (${prayer.arabicName}) is in ${minutesBefore} minutes (${formattedTime}). Good time to wrap up your current task!`,
        startLabel,
        snoozeLabel,
        'Dismiss'
      )
      .then((selection) => {
        if (selection === startLabel) {
          this.startBreak(prayer.name);
        } else if (selection === snoozeLabel) {
          this.snooze(prayer);
        }
      });
  }

  private triggerPrayerTimeNotification(prayer: PrayerScheduleItem, isSnoozed: boolean): void {
    const config = this.calculator.getConfiguration();
    const formattedTime = this.calculator.formatTime(prayer.time);
    const startLabel = `Start Break (${config.breakDurationMinutes}m)`;
    const snoozeLabel = `Snooze (${config.snoozeMinutes}m)`;

    const message = isSnoozed
      ? `🕌 Snooze Reminder: Time for ${prayer.name} (${prayer.arabicName}) prayer!`
      : `🕌 Hayya 'ala-s-Salah! It is time for ${prayer.name} (${prayer.arabicName}) prayer (${formattedTime}).`;

    vscode.window
      .showInformationMessage(message, startLabel, snoozeLabel, 'Dismiss')
      .then((selection) => {
        if (selection === startLabel) {
          this.startBreak(prayer.name);
        } else if (selection === snoozeLabel) {
          this.snooze(prayer);
        }
      });
  }


  public startBreak(prayerName?: string, customMinutes?: number): void {
    const config = this.calculator.getConfiguration();
    const duration = customMinutes ?? config.breakDurationMinutes;
    const nextInfo = this.calculator.getNextObligatoryPrayer();
    const label = prayerName || nextInfo?.prayer.name || 'Prayer';

    this.activeBreak = {
      prayerName: label,
      endsAt: new Date(Date.now() + duration * 60 * 1000)
    };
    this.snoozeState = null;
    this.tick();

    vscode.window
      .showInformationMessage(
        `🕌 Started ${duration}-minute break for ${label}. Step away from the screen and enjoy your prayer!`,
        'End Break Early'
      )
      .then((choice) => {
        if (choice === 'End Break Early') {
          this.endBreak();
        }
      });
  }

  public endBreak(): void {
    if (!this.activeBreak) {
      vscode.window.showInformationMessage('🕌 No active prayer break right now.');
      return;
    }
    const name = this.activeBreak.prayerName;
    this.activeBreak = null;
    this.tick();
    vscode.window.showInformationMessage(`🕌 Ended ${name} break. Welcome back!`);
  }

  public snooze(prayer?: PrayerScheduleItem): void {
    const config = this.calculator.getConfiguration();
    const targetPrayer =
      prayer ||
      this.calculator.getNextObligatoryPrayer()?.prayer || {
        id: 'dhuhr',
        name: 'Prayer',
        arabicName: 'الصلاة',
        time: new Date(),
        isObligatory: true
      };

    this.snoozeState = {
      prayer: targetPrayer,
      remindAt: new Date(Date.now() + config.snoozeMinutes * 60 * 1000)
    };
    this.tick();
    vscode.window.showInformationMessage(
      `🕌 Snoozed ${targetPrayer.name} reminder for ${config.snoozeMinutes} minutes.`
    );
  }


  private buildTooltip(now: Date, nextPrayer?: PrayerScheduleItem): vscode.MarkdownString {
    const schedule = this.calculator.getScheduleForDate(now);
    const config = this.calculator.getConfiguration();
    const hijri = this.calculator.getHijriDateString(now);
    const locationDisplay =
      config.cityName ||
      (config.latitude !== null && config.longitude !== null
        ? `${config.latitude}, ${config.longitude}`
        : 'Unconfigured');

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportThemeIcons = true;

    md.appendMarkdown(`### 🕌 Prayer Schedule — ${locationDisplay}\n`);
    if (hijri) {
      md.appendMarkdown(`*${hijri}* • Method: \`${config.calculationMethod}\` (${config.madhab})\n\n`);
    } else {
      md.appendMarkdown(`Method: \`${config.calculationMethod}\` (${config.madhab})\n\n`);
    }

    if (this.activeBreak) {
      const rem = this.calculator.formatExactTimer(
        this.activeBreak.endsAt.getTime() - now.getTime()
      );
      md.appendMarkdown(
        `> **$(clock) Active Break:** ${this.activeBreak.prayerName} (${rem} remaining) — [End Break](command:prayerBreaks.endBreak)\n\n`
      );
    }

    if (schedule) {
      md.appendMarkdown(`| Prayer | Arabic | Time | Status |\n`);
      md.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);

      for (const item of schedule) {
        const timeStr = this.calculator.formatTime(item.time);
        const isNext = nextPrayer && item.id === nextPrayer.id && item.time.getDate() === now.getDate();
        const isPassed = item.time.getTime() <= now.getTime();

        let status = '';
        if (isNext) {
          const countdown = this.calculator.formatCountdown(item.time.getTime() - now.getTime());
          status = `**Next (in ${countdown})**`;
        } else if (isPassed) {
          status = `$(check) Passed`;
        } else {
          status = `Upcoming`;
        }

        const rowName = isNext ? `**${item.name}**` : item.name;
        const rowTime = isNext ? `**${timeStr}**` : timeStr;
        md.appendMarkdown(`| ${rowName} | ${item.arabicName} | ${rowTime} | ${status} |\n`);
      }
    }

    md.appendMarkdown(`\n---\n`);
    if (this.activeBreak) {
      md.appendMarkdown(
        `[$(debug-stop) End Break](command:prayerBreaks.endBreak) &nbsp;|&nbsp; `
      );
    } else {
      md.appendMarkdown(
        `[$(play) Start ${config.breakDurationMinutes}m Break](command:prayerBreaks.startBreak) &nbsp;|&nbsp; `
      );
    }
    md.appendMarkdown(
      `[$(location) Change Location](command:prayerBreaks.selectCity) &nbsp;|&nbsp; [$(gear) Method](command:prayerBreaks.selectCalculationMethod)`
    );

    return md;
  }

  public async showInteractiveMenu(): Promise<void> {
    const now = new Date();
    const config = this.calculator.getConfiguration();
    const schedule = this.calculator.getScheduleForDate(now);
    const nextInfo = this.calculator.getNextObligatoryPrayer(now);
    const hijri = this.calculator.getHijriDateString(now);

    const items: (vscode.QuickPickItem & { action?: () => Promise<void> | void })[] = [];

    // Break actions
    if (this.activeBreak) {
      const rem = this.calculator.formatExactTimer(
        this.activeBreak.endsAt.getTime() - now.getTime()
      );
      items.push({
        label: `$(debug-stop) End Current Break (${this.activeBreak.prayerName} — ${rem} left)`,
        description: 'Resume coding',
        action: () => this.endBreak()
      });
    } else {
      const nextName = nextInfo?.prayer.name ?? 'Prayer';
      items.push({
        label: `$(play) Start Prayer Break (${config.breakDurationMinutes} min)`,
        description: `Take a mindful break for ${nextName}`,
        action: () => this.startBreak(nextName)
      });
    }

    if (nextInfo) {
      items.push({
        label: `$(bell) Snooze Next Reminder (${config.snoozeMinutes} min)`,
        description: `Next: ${nextInfo.prayer.name} at ${this.calculator.formatTime(nextInfo.prayer.time)}`,
        action: () => this.snooze(nextInfo.prayer)
      });
    }

    // Today's Schedule section
    if (schedule) {
      items.push({
        label: `Today's Schedule (${config.cityName || 'Configured Location'}${hijri ? ' • ' + hijri : ''})`,
        kind: vscode.QuickPickItemKind.Separator
      });

      for (const s of schedule) {
        const isNext = nextInfo && s.id === nextInfo.prayer.id && s.time.getDate() === now.getDate();
        const isPassed = s.time.getTime() <= now.getTime();
        const icon = isNext ? '$(arrow-right)' : isPassed ? '$(check)' : '$(clock)';
        const statusDesc = isNext
          ? `Next — in ${this.calculator.formatCountdown(s.time.getTime() - now.getTime())}`
          : isPassed
            ? 'Passed'
            : '';

        items.push({
          label: `${icon} ${s.name} (${s.arabicName})`,
          description: `${this.calculator.formatTime(s.time)}   ${statusDesc}`,
          action: () => {
            if (s.isObligatory) {
              this.startBreak(s.name);
            }
          }
        });
      }
    }

    // Configuration actions
    items.push({
      label: 'Settings & Configuration',
      kind: vscode.QuickPickItemKind.Separator
    });

    items.push({
      label: '$(location) Select City or Set Coordinates',
      description: config.cityName || `${config.latitude ?? 'Unset'}, ${config.longitude ?? 'Unset'}`,
      action: () => this.promptSelectCity()
    });

    items.push({
      label: '$(globe) Auto-Detect Location via IP',
      description: 'Refresh coordinates automatically',
      action: () => this.promptDetectLocation()
    });

    items.push({
      label: '$(compass) Change Calculation Method',
      description: `Current: ${config.calculationMethod}`,
      action: () => this.promptSelectCalculationMethod()
    });

    items.push({
      label: '$(law) Change Asr Juristic Method (Madhab)',
      description: `Current: ${config.madhab}`,
      action: () => this.promptSelectMadhab()
    });

    items.push({
      label: '$(gear) Open Extension Settings',
      description: 'Configure pre-reminder time, break duration, 24h format',
      action: () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'prayerBreaks');
      }
    });

    const selected = await vscode.window.showQuickPick(items, {
      title: '🕌 Prayer Breaks — Schedule & Actions',
      placeHolder: 'Select an action or click a prayer to start a break'
    });

    if (selected?.action) {
      await selected.action();
    }
  }


  public async promptDetectLocation(): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '🕌 Detecting your location via IP...',
        cancellable: false
      },
      async () => {
        const detected = await detectLocationViaIP();
        if (detected) {
          const suggested = suggestCalculationMethodByCountry(detected.countryCode);
          await saveLocationToConfig(
            detected.latitude,
            detected.longitude,
            detected.cityName,
            suggested
          );
          this.tick();
          vscode.window.showInformationMessage(
            `🕌 Location updated to ${detected.cityName} (${detected.latitude}, ${detected.longitude}).`
          );
        } else {
          vscode.window.showErrorMessage(
            '🕌 Could not auto-detect location. Please choose a city or enter coordinates manually.'
          );
        }
      }
    );
  }

  public async promptSelectCity(): Promise<void> {
    interface CityPickItem extends vscode.QuickPickItem {
      mode: 'auto' | 'manual' | 'preset';
      preset?: (typeof CITY_PRESETS)[number];
    }

    const items: CityPickItem[] = [
      {
        label: '$(globe) Auto-Detect Location via IP',
        description: 'Automatically detect your city and coordinates',
        mode: 'auto'
      },
      {
        label: '$(edit) Enter Custom Latitude & Longitude...',
        description: 'Set exact coordinates for any location worldwide',
        mode: 'manual'
      },
      {
        label: 'Popular Cities',
        kind: vscode.QuickPickItemKind.Separator,
        mode: 'preset'
      },
      ...CITY_PRESETS.map((city) => ({
        label: `$(location) ${city.name}, ${city.country}`,
        description: `${city.latitude}, ${city.longitude}`,
        detail: city.recommendedMethod ? `Recommended Method: ${city.recommendedMethod}` : undefined,
        mode: 'preset' as const,
        preset: city
      }))
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: '🕌 Select Your Location',
      placeHolder: 'Search for a city, auto-detect via IP, or enter custom coordinates'
    });

    if (!picked) {
      return;
    }

    if (picked.mode === 'auto') {
      await this.promptDetectLocation();
      return;
    }

    if (picked.mode === 'manual') {
      const latInput = await vscode.window.showInputBox({
        title: '🕌 Enter Latitude (-90 to 90)',
        prompt: 'Example: 21.4225 for Makkah, 30.0444 for Cairo',
        validateInput: (val) => {
          const num = Number(val);
          if (val.trim() === '' || Number.isNaN(num) || num < -90 || num > 90) {
            return 'Please enter a valid latitude between -90 and 90';
          }
          return null;
        }
      });
      if (latInput === undefined) {
        return;
      }

      const lonInput = await vscode.window.showInputBox({
        title: '🕌 Enter Longitude (-180 to 180)',
        prompt: 'Example: 39.8262 for Makkah, 31.2357 for Cairo',
        validateInput: (val) => {
          const num = Number(val);
          if (val.trim() === '' || Number.isNaN(num) || num < -180 || num > 180) {
            return 'Please enter a valid longitude between -180 and 180';
          }
          return null;
        }
      });
      if (lonInput === undefined) {
        return;
      }

      const cityInput = await vscode.window.showInputBox({
        title: '🕌 Enter Location Display Name (Optional)',
        prompt: 'Example: Makkah, Cairo, Home, Office',
        placeHolder: 'Custom Location'
      });
      if (cityInput === undefined) {
        return;
      }

      const lat = Number(latInput);
      const lon = Number(lonInput);
      const name = cityInput.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      await saveLocationToConfig(lat, lon, name);
      this.tick();
      vscode.window.showInformationMessage(`🕌 Location set to ${name} (${lat}, ${lon}).`);
      return;
    }

    if (picked.preset) {
      const { name, country, latitude, longitude, recommendedMethod } = picked.preset;
      const fullCityName = `${name}, ${country}`;
      const config = vscode.workspace.getConfiguration('prayerBreaks');
      await config.update('latitude', latitude, vscode.ConfigurationTarget.Global);
      await config.update('longitude', longitude, vscode.ConfigurationTarget.Global);
      await config.update('cityName', fullCityName, vscode.ConfigurationTarget.Global);
      if (recommendedMethod) {
        await config.update('calculationMethod', recommendedMethod, vscode.ConfigurationTarget.Global);
      }
      this.tick();
      vscode.window.showInformationMessage(
        `🕌 Location set to ${fullCityName} (Method: ${recommendedMethod || config.get('calculationMethod')}).`
      );
    }
  }

  public async promptSelectCalculationMethod(): Promise<void> {
    const methods: { id: string; label: string; description: string }[] = [
      { id: 'MuslimWorldLeague', label: 'Muslim World League (MWL)', description: 'Europe, Far East, parts of US' },
      { id: 'UmmAlQura', label: 'Umm al-Qura University, Makkah', description: 'Saudi Arabia & Arabian Peninsula' },
      { id: 'Egyptian', label: 'Egyptian General Authority of Survey', description: 'Africa, Syria, Lebanon, Malaysia' },
      { id: 'Karachi', label: 'University of Islamic Sciences, Karachi', description: 'Pakistan, Bangladesh, India, Afghanistan' },
      { id: 'NorthAmerica', label: 'ISNA (North America)', description: 'United States & Canada' },
      { id: 'Dubai', label: 'Dubai / UAE', description: 'United Arab Emirates' },
      { id: 'Qatar', label: 'Qatar', description: 'Qatar' },
      { id: 'Kuwait', label: 'Kuwait', description: 'Kuwait' },
      { id: 'Turkey', label: 'Diyanet İşleri Başkanlığı, Turkey', description: 'Turkey' },
      { id: 'Singapore', label: 'MUIS Singapore', description: 'Singapore, Malaysia, Indonesia' },
      { id: 'MoonsightingCommittee', label: 'Moonsighting Committee', description: 'UK & High-latitude regions' },
      { id: 'Tehran', label: 'University of Tehran', description: 'Iran' }
    ];

    const current = this.calculator.getConfiguration().calculationMethod;
    const picked = await vscode.window.showQuickPick(
      methods.map((m) => ({
        label: `${m.id === current ? '$(check) ' : ''}${m.label}`,
        description: m.description,
        id: m.id
      })),
      {
        title: '🕌 Select Prayer Calculation Method',
        placeHolder: 'Choose the astronomical calculation authority for your region'
      }
    );

    if (picked) {
      const config = vscode.workspace.getConfiguration('prayerBreaks');
      await config.update('calculationMethod', picked.id, vscode.ConfigurationTarget.Global);
      this.tick();
      vscode.window.showInformationMessage(`🕌 Calculation method updated to ${picked.label.replace('$(check) ', '')}.`);
    }
  }

  public async promptSelectMadhab(): Promise<void> {
    const current = this.calculator.getConfiguration().madhab;
    const options = [
      {
        id: 'Shafi',
        label: `${current === 'Shafi' ? '$(check) ' : ''}Standard (Shafi'i, Maliki, Hanbali)`,
        description: 'Earlier Asr time (shadow length = 1x object height)'
      },
      {
        id: 'Hanafi',
        label: `${current === 'Hanafi' ? '$(check) ' : ''}Hanafi`,
        description: 'Later Asr time (shadow length = 2x object height)'
      }
    ];

    const picked = await vscode.window.showQuickPick(options, {
      title: '🕌 Select Asr Juristic Method (Madhab)',
      placeHolder: 'Choose how Asr prayer time is calculated'
    });

    if (picked) {
      const config = vscode.workspace.getConfiguration('prayerBreaks');
      await config.update('madhab', picked.id, vscode.ConfigurationTarget.Global);
      this.tick();
      vscode.window.showInformationMessage(`🕌 Asr juristic method set to ${picked.id}.`);
    }
  }

  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.statusBarItem.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
