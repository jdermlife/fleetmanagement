import { loadEnv } from 'vite'

const expectedApiUrl = process.env.MOBILE_API_URL || 'https://fleetmanagement-dq9t.onrender.com'
const environment = loadEnv('production', process.cwd(), '')
const configuredApiUrl = environment.VITE_API_URL?.trim().replace(/\/$/, '')
const configuredAppleIosClientId = environment.VITE_APPLE_IOS_CLIENT_ID?.trim()

if (!configuredApiUrl) {
  throw new Error('VITE_API_URL is required for native production builds. Configure it in frontend/.env.production or the build environment.')
}

let parsedUrl
try {
  parsedUrl = new URL(configuredApiUrl)
} catch {
  throw new Error(`VITE_API_URL is not a valid absolute URL: ${configuredApiUrl}`)
}

if (parsedUrl.protocol !== 'https:') {
  throw new Error('Native production VITE_API_URL must use HTTPS.')
}
if (!/^[a-z0-9.-]+$/i.test(parsedUrl.hostname)) {
  throw new Error(`VITE_API_URL contains an invalid hostname: ${parsedUrl.hostname}`)
}
if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
  throw new Error('Native production VITE_API_URL must not contain credentials, query parameters, or fragments.')
}
if (configuredApiUrl !== expectedApiUrl) {
  throw new Error(`Native production API mismatch. Expected ${expectedApiUrl}, received ${configuredApiUrl}.`)
}
if (configuredAppleIosClientId !== 'com.fms.mobile') {
  throw new Error('VITE_APPLE_IOS_CLIENT_ID must match the iOS bundle ID com.fms.mobile.')
}

console.log(`Native API configuration verified: ${configuredApiUrl}`)
console.log(`Native Apple client verified: ${configuredAppleIosClientId}`)