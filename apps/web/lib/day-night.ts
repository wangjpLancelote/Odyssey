export type DayNight = "DAY" | "NIGHT";

export function detectDayNightBySystemTime(date = new Date()): DayNight {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "DAY" : "NIGHT";
}
