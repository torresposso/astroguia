import { resolve } from 'path'
import { existsSync } from 'fs'

function resolveDataDir(): string {
  if (process.env.ASTROGUIA_DATA_DIR) {
    return process.env.ASTROGUIA_DATA_DIR
  }
  const cwd = process.cwd()

  const candidates = [
    resolve(cwd, 'public'),
    resolve(cwd, 'src/mastra/public'),
    cwd,
  ]

  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }

  return candidates[0]
}

export const DATA_DIR = resolveDataDir()

export function getDbPath(name: string): string {
  return `file:${resolve(DATA_DIR, name)}`
}
