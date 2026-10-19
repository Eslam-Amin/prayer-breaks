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

export function getCalculationParams(methodName: string, madhabName: string, highLatRuleName: string): CalculationParameters {
  let params: CalculationParameters;
  switch (methodName) {
    case 'Egyptian':
      params = CalculationMethod.Egyptian();
      break;
    case 'Karachi':
      params = CalculationMethod.Karachi();
      break;
    case 'UmmAlQura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'Dubai':
      params = CalculationMethod.Dubai();
      break;
    case 'MoonsightingCommittee':
      params = CalculationMethod.MoonsightingCommittee();
      break;
    case 'NorthAmerica':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'Kuwait':
      params = CalculationMethod.Kuwait();
      break;
    case 'Qatar':
      params = CalculationMethod.Qatar();
      break;
    case 'Singapore':
      params = CalculationMethod.Singapore();
      break;
    case 'Tehran':
      params = CalculationMethod.Tehran();
      break;
    case 'Turkey':
      params = CalculationMethod.Turkey();
      break;
    case 'MuslimWorldLeague':
    default:
      params = CalculationMethod.MuslimWorldLeague();
      break;
  }

  params.madhab = madhabName === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;

  switch (highLatRuleName) {
    case 'SeventhOfTheNight':
      params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
      break;
    case 'TwilightAngle':
      params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
      break;
    case 'MiddleOfTheNight':
    default:
      params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
      break;
  }

  return params;
}
