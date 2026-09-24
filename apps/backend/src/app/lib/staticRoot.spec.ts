import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

it('uses the repository staging directory when launched from the backend package', async () => {
    vi.stubEnv('STATIC_ROOT', undefined)
    const { STATIC_ROOT } = await import('./staticRoot.js')

    expect(STATIC_ROOT).toBe(path.resolve(process.cwd(), '../../.local-static'))
})

it('preserves an explicitly configured static directory', async () => {
    vi.stubEnv('STATIC_ROOT', '/tmp/hosted-game-assets')
    const { STATIC_ROOT } = await import('./staticRoot.js')

    expect(STATIC_ROOT).toBe('/tmp/hosted-game-assets')
})
