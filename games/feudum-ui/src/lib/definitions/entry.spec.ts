import { describe, expect, it, vi } from 'vitest'
import { FeudumInfo } from '@tabletop/feudum'

const Modules = Object.keys(import.meta.glob('/src/lib/**/*.{ts,svelte}'))

const Entry = '/src/lib/definitions/definition.ts'
const Cover = '/src/lib/art/cover.ts'
const Runtime = '/src/lib/definitions/runtime.ts'

function trapTheRest(): string[] {
    const loaded: string[] = []
    vi.resetModules()
    for (const path of Modules.filter((path) => path !== Entry && path !== Cover)) {
        vi.doMock(path, () => {
            loaded.push(path)
            throw new Error(`${path} is loaded`)
        })
    }
    vi.doMock('@tabletop/feudum', async () => ({
        FeudumInfo: (await vi.importActual<typeof import('@tabletop/feudum')>('@tabletop/feudum'))
            .FeudumInfo
    }))
    vi.doMock('@tabletop/frontend-components', () => {
        loaded.push('@tabletop/frontend-components')
        throw new Error('@tabletop/frontend-components is loaded')
    })
    return loaded
}

/**
 * The site loads every title's UI entry on each signed-in page to list its library, so the
 * entry holds the title's info and its cover only, and the game comes through `runtime()`.
 */
describe('the UI entry', () => {
    it('finds the package modules it sets traps on', () => {
        expect(Modules).toEqual(expect.arrayContaining([Entry, Cover, Runtime]))
    })

    it('loads with every other module a trap, holding the title info and the cover', async () => {
        const loaded = trapTheRest()
        const { UiDefinition } = await import('./definition.js')

        expect(loaded).toEqual([])
        expect(UiDefinition.info).toMatchObject(FeudumInfo)
        expect(typeof UiDefinition.info.thumbnailUrl).toBe('string')
    })

    it('reaches the game only through runtime()', async () => {
        const loaded = trapTheRest()
        const { UiDefinition } = await import('./definition.js')
        expect(loaded).toEqual([])

        await expect(UiDefinition.runtime()).rejects.toThrow()
        expect(loaded).toContain(Runtime)
    })
})
