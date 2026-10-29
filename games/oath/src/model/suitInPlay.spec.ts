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

/** Any mention of the registry's suit by name: an aliased import or a namespace's member names it too. */
const REGISTRY_SUIT = /\bsuitOf\b/

/** The code alone: comments and quoted strings (module paths among them) set aside. */
function codeOf(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/(['"`])[^'"`\n]*\1/g, "''")
}

function readsPrintedSuit(source: string): boolean {
    return REGISTRY_SUIT.test(codeOf(source))
}

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
                    !REGISTRY_SUIT_READERS.includes(path) && readsPrintedSuit(source)
            )
            .map(({ path }) => path)
        expect(offending).toEqual([])
    })

    it('each listed reader still reads it', async () => {
        const readers = (await productionSources())
            .filter(({ source }) => readsPrintedSuit(source))
            .map(({ path }) => path)
        expect([...readers].sort()).toEqual([...REGISTRY_SUIT_READERS].sort())
    })

    it('an aliased import or a namespace import is caught', () => {
        const aliased =
            "import { suitOf as printedSuit } from '../data/cardRegistry.js'\nprintedSuit(id)"
        const namespaced =
            "import * as registry from '../data/cardRegistry.js'\nregistry.suitOf(id)"
        const other = "import { kindOf } from '../data/cardRegistry.js'\nkindOf(id)"
        expect(readsPrintedSuit(aliased)).toBe(true)
        expect(readsPrintedSuit(namespaced)).toBe(true)
        expect(readsPrintedSuit(other)).toBe(false)
    })
})
