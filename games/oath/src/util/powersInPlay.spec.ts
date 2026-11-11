import { describe, expect, it, vi } from 'vitest'
import { cardIdsOfKind } from '../data/cardRegistry.js'
import { cardPowers, EDIFICE_POWER_INDEX, EdificeFace, PowerTiming } from '../data/cardPowers.js'
import { CardKind } from '../model/oathEnums.js'
import { hasEffect } from '../powers/registry.js'
import {
    ANCIENT_FORGE,
    DANA,
    FESTIVAL_DISTRICT,
    HALL_OF_DEBATE,
    STONES_SLOT,
    edificeTable,
    placeEdifice
} from '../testing/edifices.js'
import { legalPowers, reasonCannotUsePower } from './powerDoorway.js'
import { powerInPlay, powersInPlay, reasonSideFaceDown } from './powersInPlay.js'
import '../powers/index.js'

interface SourceFiles {
    readdirSync(path: URL, options: { recursive: true; encoding: 'utf8' }): string[]
    readFileSync(path: URL, encoding: 'utf8'): string
}

const SRC = new URL('../', import.meta.url)

/**
 * The registry, the ruin-aware read, and the readers whose card is never an edifice in play: a site
 * card's printed Action (R-11.9), a card being played for its When Played power (R-7.3.3; an edifice
 * is never played from a hand), and Witch's Bargain's own power.
 */
const PRINTED_POWER_READERS = [
    'data/cardPowers.ts',
    // It re-exports them, so a file importing them from it names them too.
    'data/cardRegistry.ts',
    'util/powersInPlay.ts',
    'util/access.ts',
    'util/hiddenInputs.ts',
    'util/cardPlay.ts',
    'util/witchsBargain.ts'
]

/**
 * Any mention of a printed-power reader by name, a call or not, once module paths are set aside:
 * an aliased import (`cardPowers as powers`) and a namespace's member (`data.cardPowers`) still name it.
 */
const PRINTED_POWERS = /\b(powersWithTiming|cardPowers|cardPower)\b/

/** The code alone: comments and quoted strings (module paths among them) set aside. */
function codeOf(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/(['"`])[^'"`\n]*\1/g, "''")
}

function readsPrintedPowers(source: string): boolean {
    return PRINTED_POWERS.test(codeOf(source))
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

describe('R-2.9 — a card in play has the powers of the side it shows', () => {
    it('no engine file reads a card’s printed powers outside the listed readers', async () => {
        const offending = (await productionSources())
            .filter(
                ({ path, source }) =>
                    !PRINTED_POWER_READERS.includes(path) && readsPrintedPowers(source)
            )
            .map(({ path }) => path)
        expect(offending).toEqual([])
    })

    it('each listed reader still reads them', async () => {
        const readers = (await productionSources())
            .filter(({ source }) => readsPrintedPowers(source))
            .map(({ path }) => path)
        expect([...readers].sort()).toEqual([...PRINTED_POWER_READERS].sort())
    })

    it('an aliased import or a namespace import is caught; another import from the module is not', () => {
        const aliased = "import { cardPowers as printed } from '../data/cardPowers.js'\nprinted(id)"
        const namespaced = "import * as data from '../data/cardPowers.js'\ndata.cardPower(id, 0)"
        const other = "import { PowerTiming } from '../data/cardPowers.js'\nPowerTiming.Action"
        const comment = '/** `cardPowers.ts` registers both. */\n// cardPower(id) is not read here'
        expect(readsPrintedPowers(aliased)).toBe(true)
        expect(readsPrintedPowers(namespaced)).toBe(true)
        expect(readsPrintedPowers(other)).toBe(false)
        expect(readsPrintedPowers(comment)).toBe(false)
    })
})

describe('R-2.9 — each edifice is one card with two powers, one per side', () => {
    it('registers the twelve sides: the intact side’s power first, the ruined side’s second', () => {
        const edifices = cardIdsOfKind(CardKind.Edifice)
        expect(edifices).toHaveLength(6)
        for (const cardId of edifices) {
            const powers = cardPowers(cardId)
            expect(powers.map((p) => p.face)).toEqual([EdificeFace.Intact, EdificeFace.Ruined])
            expect(powers.map((p) => p.powerIndex)).toEqual([
                EDIFICE_POWER_INDEX[EdificeFace.Intact],
                EDIFICE_POWER_INDEX[EdificeFace.Ruined]
            ])
        }
        expect(cardPowers(ANCIENT_FORGE).map((p) => p.timing)).toEqual([
            PowerTiming.Action,
            PowerTiming.Action
        ])
    })

    it('gives only the side showing, and every power of any other card', () => {
        const state = edificeTable()
        expect(powersInPlay(state, HALL_OF_DEBATE).map((p) => p.powerIndex)).toEqual([0])
        expect(powersInPlay(state, ANCIENT_FORGE).map((p) => p.powerIndex)).toEqual([1])
        expect(powersInPlay(state, ANCIENT_FORGE, PowerTiming.Action)).toHaveLength(1)
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        state.setEdificeRuined(ANCIENT_FORGE, false)
        expect(powersInPlay(state, HALL_OF_DEBATE).map((p) => p.powerIndex)).toEqual([1])
        expect(powersInPlay(state, ANCIENT_FORGE).map((p) => p.powerIndex)).toEqual([0])
        const wolves = 'denizen.beast.wolves'
        expect(powersInPlay(state, wolves)).toEqual(cardPowers(wolves))
    })

    it('a use naming the side that is down names no power in play, and says why', () => {
        const state = edificeTable()
        expect(powerInPlay(state, ANCIENT_FORGE, 0)).toBeUndefined()
        expect(powerInPlay(state, ANCIENT_FORGE, 1)?.face).toBe(EdificeFace.Ruined)
        expect(reasonSideFaceDown(state, ANCIENT_FORGE, 0)).toBe(
            'Ancient Forge: that side of the card is face down'
        )
        expect(reasonSideFaceDown(state, ANCIENT_FORGE, 1)).toBeUndefined()
        expect(reasonSideFaceDown(state, HALL_OF_DEBATE, 1)).toBe(
            'Hall of Mockery: that side of the card is face down'
        )
    })
})

describe('R-7.1.1 — the doorway sees only the side showing', () => {
    it('refuses the side that is down, for a ruin and for an intact card', () => {
        const state = edificeTable({ [DANA]: { siteId: STONES_SLOT } })
        expect(reasonCannotUsePower(state, DANA, ANCIENT_FORGE, 0, PowerTiming.Action)).toBe(
            'Ancient Forge: that side of the card is face down'
        )
        state.setEdificeRuined(ANCIENT_FORGE, false)
        expect(reasonCannotUsePower(state, DANA, ANCIENT_FORGE, 1, PowerTiming.Action)).toBe(
            'Broken Forge: that side of the card is face down'
        )
    })

    it('every side of every edifice has an effect, and Festival District is offered with its side up', () => {
        const sides = cardIdsOfKind(CardKind.Edifice).flatMap((cardId) => cardPowers(cardId))
        expect(sides).toHaveLength(12)
        expect(sides.filter((power) => !hasEffect(power))).toEqual([])
        const state = edificeTable({ [DANA]: { siteId: STONES_SLOT } })
        state.setEdificeRuined(ANCIENT_FORGE, false)
        state.denizensBySite[STONES_SLOT] = []
        placeEdifice(state, STONES_SLOT, FESTIVAL_DISTRICT)
        expect(
            legalPowers(state, DANA, PowerTiming.Action).filter(
                (use) => use.cardId === FESTIVAL_DISTRICT
            )
        ).toHaveLength(1)
    })
})
