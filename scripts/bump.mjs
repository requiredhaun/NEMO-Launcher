// Bump patch version on every dist build: 0.1.3 -> 0.1.4
import { readFileSync, writeFileSync } from 'node:fs'

const url = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(url, 'utf-8'))
const parts = String(pkg.version || '0.1.0').split('.').map(Number)
while (parts.length < 3) parts.push(0)
parts[2] += 1
pkg.version = parts.join('.')
writeFileSync(url, JSON.stringify(pkg, null, 2) + '\n')
console.log(`[bump] version -> ${pkg.version}`)
