import { spawnSync } from 'node:child_process'

const requestedPlatform = process.argv[2]
const platforms = requestedPlatform ? [requestedPlatform] : ['android', 'ios']

if (platforms.some((platform) => platform !== 'android' && platform !== 'ios')) {
  throw new Error('Mobile sync platform must be android or ios.')
}

const npmCli = process.env.npm_execpath
if (!npmCli) {
  throw new Error('Run this script through an npm mobile sync command.')
}

function run(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

for (const platform of platforms) {
  const distributionChannel = platform === 'ios' ? 'app-store' : 'play-store'
  const environment = {
    ...process.env,
    VITE_DISTRIBUTION_CHANNEL: distributionChannel,
    MOBILE_PLATFORM: platform,
  }

  run(process.execPath, ['scripts/validate-mobile-release.mjs'], environment)
  run(process.execPath, [npmCli, 'run', 'build'], environment)
  run(process.execPath, [npmCli, 'exec', '--', 'cap', 'sync', platform], environment)
  run(process.execPath, ['scripts/verify-mobile-assets.mjs', platform], environment)
}
