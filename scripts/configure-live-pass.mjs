import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function configureLivePass(root = process.cwd()) {
  const wranglerPath = path.join(root, 'wrangler.jsonc')
  const vitePath = path.join(root, 'vite.config.ts')
  const [rawWrangler, rawVite] = await Promise.all([
    readFile(wranglerPath, 'utf8'), readFile(vitePath, 'utf8'),
  ])
  let config
  try { config = JSON.parse(rawWrangler) }
  catch {
    // Use the project's existing TypeScript parser for commented JSONC.
    const { default: ts } = await import('typescript')
    const parsed = ts.parseConfigFileTextToJson(wranglerPath, rawWrangler)
    if (parsed.error) throw new Error('Unable to parse wrangler.jsonc. No files changed.')
    config = parsed.config
  }
  const bindings = config.durable_objects?.bindings ?? []
  const existing = bindings.find(binding => binding.name === 'GUEST_PASS_ROOMS')
  if (existing && existing.class_name !== 'GuestPassRoom') {
    throw new Error('GUEST_PASS_ROOMS already belongs to another class. No files changed.')
  }
  const migrations = config.migrations ?? []
  const migration = migrations.find(item => item.tag === 'guest-pass-live-v1')
  if (migration && !migration.new_sqlite_classes?.includes('GuestPassRoom')) {
    throw new Error('The guest-pass-live-v1 migration tag is already used. No files changed.')
  }
  const proxies = [...rawVite.matchAll(/(['"])\/api\1\s*:\s*\{([^{}]*)\}/g)]
  if (proxies.length !== 1) throw new Error('Unable to identify the /api proxy. Add ws: true manually; no files changed.')
  const proxy = proxies[0]
  let body = proxy[2]
  if (/\bws\s*:/.test(body)) {
    if (!/\bws\s*:\s*(?:true|false)\b/.test(body)) throw new Error('Unexpected ws proxy option. No files changed.')
    body = body.replace(/\bws\s*:\s*(?:true|false)\b/, 'ws: true')
  } else body = `\n        ws: true,${body}`
  const replacement = proxy[0].replace(proxy[2], body)
  const nextVite = rawVite.slice(0, proxy.index) + replacement + rawVite.slice(proxy.index + proxy[0].length)
  config.durable_objects = { ...config.durable_objects, bindings: existing ? bindings : [...bindings, { name: 'GUEST_PASS_ROOMS', class_name: 'GuestPassRoom' }] }
  config.migrations = migration ? migrations : [...migrations, { tag: 'guest-pass-live-v1', new_sqlite_classes: ['GuestPassRoom'] }]
  const nextWrangler = JSON.stringify(config, null, 2) + '\n'
  // Both configurations are validated before writing. Preserve an original copy.
  for (const [file, contents] of [[wranglerPath, rawWrangler], [vitePath, rawVite]]) {
    try { await access(file + '.before-live-pass') }
    catch { await writeFile(file + '.before-live-pass', contents, { flag: 'wx' }) }
  }
  if (nextWrangler !== rawWrangler) await writeFile(wranglerPath, nextWrangler)
  if (nextVite !== rawVite) await writeFile(vitePath, nextVite)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  configureLivePass().then(() => console.log('Live pass binding and WebSocket proxy configured. Restart the Worker and Vite.'))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
