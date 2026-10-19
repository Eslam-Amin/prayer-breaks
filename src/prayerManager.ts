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

  public tick(): void {}

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
