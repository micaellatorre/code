// src/lib/timezone.ts
import { formatInTimeZone, toDate } from 'date-fns-tz'

export const AR_TIME_ZONE = 'America/Argentina/Buenos_Aires'

// Para inputs <input type="datetime-local">
export function toArgDateTimeInputValue(date: Date) {
  // yyyy-MM-ddTHH:mm para datetime-local
  return formatInTimeZone(date, AR_TIME_ZONE, "yyyy-MM-dd'T'HH:mm")
}

export function fromArgDateTimeInputValue(value: string): Date {
  // interpreta el string como hora de Argentina y lo pasa a UTC
  return toDate(value, { timeZone: AR_TIME_ZONE })
}

// Para inputs <input type="date">
export function toArgDateInputValue(date: Date) {
  return formatInTimeZone(date, AR_TIME_ZONE, 'yyyy-MM-dd')
}

export function fromArgDateInputValue(value: string): Date {
  return toDate(value, { timeZone: AR_TIME_ZONE })
}
