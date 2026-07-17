import type { NatalInput } from '../../types'

export interface ReportTestCase {
  id: string
  label: string
  input: NatalInput & { clientName: string; city: string }
}

export const REPORT_FIXTURES: ReportTestCase[] = [
  {
    id: 'report-01',
    label: 'Standard Placidus exact time',
    input: {
      clientName: 'Alice',
      date: '1990-04-15',
      time: '14:30',
      lat: 40.7128,
      lon: -74.006,
      timezone: 'America/New_York',
      house_system: 'placidus',
      city: 'New York',
    },
  },
  {
    id: 'report-02',
    label: 'Unknown time noon default',
    input: {
      clientName: 'Bob',
      date: '1985-11-22',
      lat: 51.5074,
      lon: -0.1278,
      timezone: 'Europe/London',
      house_system: 'placidus',
      city: 'London',
    },
  },
  {
    id: 'report-03',
    label: 'Whole sign houses',
    input: {
      clientName: 'Carol',
      date: '1978-03-08',
      time: '06:15',
      lat: 35.6762,
      lon: 139.6503,
      timezone: 'Asia/Tokyo',
      house_system: 'whole_sign',
      city: 'Tokyo',
    },
  },
  {
    id: 'report-04',
    label: 'Koch houses Southern hemisphere',
    input: {
      clientName: 'Dario',
      date: '2000-07-01',
      time: '22:45',
      lat: -34.6037,
      lon: -58.3816,
      timezone: 'America/Argentina/Buenos_Aires',
      house_system: 'koch',
      city: 'Buenos Aires',
    },
  },
  {
    id: 'report-05',
    label: 'Near equator tropical',
    input: {
      clientName: 'Elena',
      date: '1995-12-25',
      time: '09:00',
      lat: -6.2088,
      lon: 106.8456,
      timezone: 'Asia/Jakarta',
      house_system: 'placidus',
      city: 'Jakarta',
    },
  },
  {
    id: 'report-06',
    label: 'Northern Scandinavia',
    input: {
      clientName: 'Fridtjof',
      date: '1988-06-21',
      time: '03:30',
      lat: 69.6496,
      lon: 18.956,
      timezone: 'Europe/Oslo',
      house_system: 'whole_sign',
      city: 'Tromsø',
    },
  },
  {
    id: 'report-07',
    label: 'Early morning birth Australia',
    input: {
      clientName: 'Grace',
      date: '1972-09-12',
      time: '04:20',
      lat: -33.8688,
      lon: 151.2093,
      timezone: 'Australia/Sydney',
      house_system: 'placidus',
      city: 'Sydney',
    },
  },
  {
    id: 'report-08',
    label: 'Late night birth deep winter',
    input: {
      clientName: 'Hiroshi',
      date: '2005-01-30',
      time: '23:55',
      lat: 35.0116,
      lon: 135.7681,
      timezone: 'Asia/Tokyo',
      house_system: 'koch',
      city: 'Kyoto',
    },
  },
  {
    id: 'report-09',
    label: 'Leap day birth',
    input: {
      clientName: 'Isabel',
      date: '1992-02-29',
      time: '12:00',
      lat: 41.3874,
      lon: 2.1686,
      timezone: 'Europe/Madrid',
      house_system: 'placidus',
      city: 'Barcelona',
    },
  },
  {
    id: 'report-10',
    label: 'Summer solstice noon',
    input: {
      clientName: 'Javier',
      date: '1980-06-21',
      time: '12:00',
      lat: 19.4326,
      lon: -99.1332,
      timezone: 'America/Mexico_City',
      house_system: 'whole_sign',
      city: 'Mexico City',
    },
  },
]
