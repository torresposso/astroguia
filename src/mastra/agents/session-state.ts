import type { Person } from '../storage/persons'

let _currentPerson: Person | null = null

export function setCurrentPerson(person: Person | null) {
  _currentPerson = person
}

export function getCurrentPerson(): Person | null {
  return _currentPerson
}

export function getCurrentPersonId(): string | null {
  return _currentPerson?.id ?? null
}

export function formatPersonForPrompt(person: Person): string {
  return [
    `Name: ${person.name}`,
    `Date: ${person.birth_date}`,
    `Time: ${person.birth_time}`,
    `City: ${person.birth_city}`,
    `Lat: ${person.birth_lat}`,
    `Lon: ${person.birth_lon}`,
    `Timezone: ${person.timezone}`,
    `House system: ${person.house_system ?? 'placidus'}`,
  ].join('\n')
}
