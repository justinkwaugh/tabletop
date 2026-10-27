import { describe, expect, it, vi } from 'vitest'

interface SourceFiles {
    readdirSync(path: URL, options: { recursive: true; encoding: 'utf8' }): string[]
    readFileSync(path: URL, encoding: 'utf8'): string
}

const SRC = new URL('../', import.meta.url)

/** The registry itself, the ruin-aware read, and the two that read card data rather than a card in play. */
const REGISTRY_SUIT_READERS = [
    'data/cardRegistry.ts',
    'model/gameState.ts',
    'data/worldDeck.ts',
    'util/exploration.ts'
]

const REGISTRY_SUIT = /\bsuitOf\b/

async function productionSources(): Promise<{ path: string; source: string }[]> {
    const fs = await vi.importActual<SourceFiles>('node:fs')
    return fs
        .readdirSync(SRC, { recursive: true, encoding: 'utf8' })
        .filter(
            (path) =>
                path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.startsWith('testing/')
        )
        .map((path) => ({ path, source: fs.readFileSync(new URL(path, SRC), 'utf8') }))
}

describe('R-2.9, R-10.14 — a card in play matches by the suit it shows', () => {
    it('no engine file reads the printed suit outside the card-data readers', async () => {
        const offending = (await productionSources())
            .filter(
                ({ path, source }) =>
                    !REGISTRY_SUIT_READERS.includes(path) && REGISTRY_SUIT.test(source)
            )
            .map(({ path }) => path)
        expect(offending).toEqual([])
    })

    it('each listed reader still reads it', async () => {
        const readers = (await productionSources())
            .filter(({ source }) => REGISTRY_SUIT.test(source))
            .map(({ path }) => path)
        expect([...readers].sort()).toEqual([...REGISTRY_SUIT_READERS].sort())
    })
})
