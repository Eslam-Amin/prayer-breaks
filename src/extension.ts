import * as vscode from 'vscode';
import { PrayerBreaksManager } from './prayerManager';

let manager: PrayerBreaksManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  manager = new PrayerBreaksManager();
  context.subscriptions.push(manager);

  context.subscriptions.push(
    vscode.commands.registerCommand('prayerBreaks.showMenu', () => manager?.showInteractiveMenu()),
    vscode.commands.registerCommand('prayerBreaks.detectLocation', () =>
      manager?.promptDetectLocation()
    ),
    vscode.commands.registerCommand('prayerBreaks.selectCity', () => manager?.promptSelectCity()),
    vscode.commands.registerCommand('prayerBreaks.selectCalculationMethod', () =>
      manager?.promptSelectCalculationMethod()
    ),
    vscode.commands.registerCommand('prayerBreaks.selectMadhab', () =>
      manager?.promptSelectMadhab()
    ),
    vscode.commands.registerCommand('prayerBreaks.startBreak', () => manager?.startBreak()),
    vscode.commands.registerCommand('prayerBreaks.endBreak', () => manager?.endBreak()),
    vscode.commands.registerCommand('prayerBreaks.snooze', () => manager?.snooze())
  );

  await manager.initialize();
}

export function deactivate(): void {
  if (manager) {
    manager.dispose();
    manager = undefined;
  }
}
