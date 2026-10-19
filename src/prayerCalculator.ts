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

export class PrayerCalculator {
  public getConfiguration() {
    const config = vscode.workspace.getConfiguration('prayerBreaks');
    const latitude = config.get<number | null>('latitude', null);
    const longitude = config.get<number | null>('longitude', null);
    const cityName = config.get<string>('cityName', '');
    const calculationMethod = config.get<string>('calculationMethod', 'MuslimWorldLeague');
    const madhab = config.get<string>('madhab', 'Shafi');
    const highLatitudeRule = config.get<string>('highLatitudeRule', 'MiddleOfTheNight');
    const use24HourFormat = config.get<boolean>('use24HourFormat', false);
    const preNotificationMinutes = config.get<number>('preNotificationMinutes', 10);
    const breakDurationMinutes = config.get<number>('breakDurationMinutes', 15);
    const snoozeMinutes = config.get<number>('snoozeMinutes', 5);

    return {
      latitude,
      longitude,
      cityName,
      calculationMethod,
      madhab,
      highLatitudeRule,
      use24HourFormat,
      preNotificationMinutes,
      breakDurationMinutes,
      snoozeMinutes
    };
  }

  public hasCoordinates(): boolean {
    const { latitude, longitude } = this.getConfiguration();
    return typeof latitude === 'number' && typeof longitude === 'number';
  }

  public getScheduleForDate(date: Date): PrayerScheduleItem[] | null {
    const { latitude, longitude, calculationMethod, madhab, highLatitudeRule } = this.getConfiguration();
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }

    const coordinates = new Coordinates(latitude, longitude);
    const params = getCalculationParams(calculationMethod, madhab, highLatitudeRule);
    const prayerTimes = new PrayerTimes(coordinates, date, params);

    const entries: PrayerEntryId[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    return entries.map((id) => ({
      id,
      name: PRAYER_METADATA[id].name,
      arabicName: PRAYER_METADATA[id].arabicName,
      time: prayerTimes[id],
      isObligatory: PRAYER_METADATA[id].isObligatory
    }));
  }

  public getNextObligatoryPrayer(now: Date = new Date()): NextPrayerInfo | null {
    const todaySchedule = this.getScheduleForDate(now);
    if (!todaySchedule) {
      return null;
    }

    const obligatoryToday = todaySchedule.filter((item) => item.isObligatory);
    for (const item of obligatoryToday) {
      const diff = item.time.getTime() - now.getTime();
      if (diff > 0) {
        return {
          prayer: item,
          remainingMs: diff
        };
      }
    }

    // All today's obligatory prayers have passed; get tomorrow's Fajr
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowSchedule = this.getScheduleForDate(tomorrow);
    if (!tomorrowSchedule) {
      return null;
    }

    const tomorrowFajr = tomorrowSchedule.find((item) => item.id === 'fajr');
    if (!tomorrowFajr) {
      return null;
    }

    return {
      prayer: tomorrowFajr,
      remainingMs: tomorrowFajr.time.getTime() - now.getTime()
    };
  }
}
