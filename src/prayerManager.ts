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
