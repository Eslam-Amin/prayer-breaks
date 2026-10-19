import {
  Coordinates,
  CalculationMethod,
  CalculationParameters,
  PrayerTimes,
  Madhab,
  HighLatitudeRule
} from 'adhan';
import * as vscode from 'vscode';

export type ObligatoryPrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PrayerEntryId = ObligatoryPrayerId | 'sunrise';

export interface PrayerScheduleItem {
  id: PrayerEntryId;
  name: string;
  arabicName: string;
  time: Date;
  isObligatory: boolean;
}

export interface NextPrayerInfo {
  prayer: PrayerScheduleItem;
  remainingMs: number;
}

export const PRAYER_METADATA: Record<PrayerEntryId, { name: string; arabicName: string; isObligatory: boolean }> = {
  fajr: { name: 'Fajr', arabicName: 'الفجر', isObligatory: true },
  sunrise: { name: 'Sunrise', arabicName: 'الشروق', isObligatory: false },
  dhuhr: { name: 'Dhuhr', arabicName: 'الظهر', isObligatory: true },
  asr: { name: 'Asr', arabicName: 'العصر', isObligatory: true },
  maghrib: { name: 'Maghrib', arabicName: 'المغرب', isObligatory: true },
  isha: { name: 'Isha', arabicName: 'العشاء', isObligatory: true }
};
