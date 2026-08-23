import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from 'vite'

const environment = loadEnv('production', process.cwd(), '')
const expectedApiUrl = environment.VITE_API_URL?.trim().replace(/\/$/, '')
const assetRoots = [
  join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public'),
  join(process.cwd(), 'ios', 'App', 'App', 'public'),
].filter(existsSync)

if (!expectedApiUrl) {
  throw new Error('VITE_API_URL is required before verifying native assets.')
}
if (assetRoots.length === 0) {
  throw new Error('No synchronized Android or iOS web assets were found. Run Capacitor sync first.')
}

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? filesIn(path) : [path]
  })
}

for (const assetRoot of assetRoots) {
  const bundleText = filesIn(assetRoot)
    .filter((path) => /\.(?:html|js|json)$/.test(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')

  if (!bundleText.includes(expectedApiUrl)) {
    throw new Error(`Synchronized assets at ${assetRoot} do not contain ${expectedApiUrl}.`)
  }
  if (bundleText.includes('fleetmanagement=dq9t')) {
    throw new Error(`Synchronized assets at ${assetRoot} contain the malformed Render hostname.`)
  }
  console.log(`Native bundle API verified: ${assetRoot}`)
}