import { existsSync } from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

// Found independently of staticRoot.ts (and of the directory the tests run from).
function repositoryRoot(): string {
    let dir = import.meta.dirname
    while (!existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
        const parent = path.dirname(dir)
        if (parent === dir) throw new Error('Repository root not found')
        dir = parent
    }
    return dir
}

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

it('uses the repository staging directory by default', async () => {
    vi.stubEnv('STATIC_ROOT', undefined)
    const { STATIC_ROOT } = await import('./staticRoot.js')

    expect(STATIC_ROOT).toBe(path.join(repositoryRoot(), '.local-static'))
})

it('preserves an explicitly configured static directory', async () => {
    vi.stubEnv('STATIC_ROOT', '/tmp/hosted-game-assets')
    const { STATIC_ROOT } = await import('./staticRoot.js')

    expect(STATIC_ROOT).toBe('/tmp/hosted-game-assets')
})
