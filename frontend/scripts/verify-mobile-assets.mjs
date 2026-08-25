import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from 'vite'

const environment = loadEnv('production', process.cwd(), '')
const expectedApiUrl = environment.VITE_API_URL?.trim().replace(/\/$/, '')
const assetRoots = [
  join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public'),
  join(process.cwd(), 'ios', 'App', 'App', 'public'),
].filter(existsSync)
const iosProjectRoot = join(process.cwd(), 'ios', 'App')

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

if (existsSync(iosProjectRoot)) {
  const capacitorConfig = readFileSync(join(iosProjectRoot, 'App', 'capacitor.config.json'), 'utf8')
  const entitlements = readFileSync(join(iosProjectRoot, 'App', 'App.entitlements'), 'utf8')
  const xcodeProject = readFileSync(join(iosProjectRoot, 'App.xcodeproj', 'project.pbxproj'), 'utf8')

  if (!capacitorConfig.includes('"apple": true')) {
    throw new Error('Synchronized iOS configuration does not enable the Apple provider.')
  }
  if (!entitlements.includes('com.apple.developer.applesignin')) {
    throw new Error('The iOS target is missing the Sign in with Apple entitlement.')
  }
  if (!xcodeProject.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;')) {
    throw new Error('The Xcode target is not configured to sign with App.entitlements.')
  }
  console.log('Native Apple capability verified: ios/App')
}