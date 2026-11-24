// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('$lib/art/suppliedFiles.js', () => ({ suppliedFiles: {} }))
vi.mock('$lib/art/cover.js', () => ({ suppliedCover: undefined }))

const art = Object.keys(import.meta.glob('/src/lib/art/supplied/*'))

describe('the supplied art folder', () => {
    it.skipIf(art.length === 0)(
        'no piece and nothing the game loads reaches into it but the one glob',
        async () => {
            const pieces = Object.values(import.meta.glob('/src/lib/components/pieces/*.svelte'))
            expect(pieces.length).toBeGreaterThan(10)
            const loaded: string[] = []
            for (const path of art) {
                vi.doMock(path, () => {
                    loaded.push(path)
                    throw new Error(`${path} is loaded`)
                })
            }
            await Promise.all(pieces.map((load) => load()))
            const { UiDefinition } = await import('$lib/definitions/definition.js')
            await UiDefinition.runtime()
            expect(loaded).toEqual([])
        },
        60_000
    )
})
