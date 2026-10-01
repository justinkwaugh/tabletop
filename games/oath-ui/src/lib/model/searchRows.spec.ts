import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    PowerChoiceKind,
    PowerTiming,
    Region,
    SearchSource,
    powerIndexOf,
    type ModifierUse
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { searchRows } from './searchRows.js'

const OBSERVATORY = 'denizen.arcane.observatory'

function board(piles: Partial<Record<Region, number>> = {}, cards: Record<string, string[]> = {}) {
    const s = testState(
        [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', favor: 2, supply: 5 })],
        {
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...cards },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            discardPileCounts: { cradle: 4, provinces: 0, hinterland: 0, ...piles }
        }
    )
    openTurn(s, 'p1')
    return s
}

const observatory = (region: Region): ModifierUse => ({
    cardId: OBSERVATORY,
    powerIndex: powerIndexOf(OBSERVATORY, PowerTiming.Modifier),
    choices: [{ kind: PowerChoiceKind.Region, region }]
})

const read = (rows: ReturnType<typeof searchRows>) =>
    rows.map((row) => [row.source, row.region, row.cost, row.draw, row.variant])

describe('the sources a Search can draw from (R-5.1.1)', () => {
    it('lists the world deck and the pawn’s region’s pile with their prices and draws', () => {
        expect(read(searchRows(board(), 'p1', [], []))).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 3, undefined],
            [SearchSource.Discard, Region.Cradle, 2, 3, undefined]
        ])
    })

    it('leaves out an empty pile', () => {
        expect(read(searchRows(board({ cradle: 0 }), 'p1', [], []))).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 3, undefined]
        ])
    })

    it('lists each pile a declared modifier may name, leaving out the empty ones (R-7.4)', () => {
        const s = board({ cradle: 0, provinces: 3, hinterland: 0 }, { c1: [OBSERVATORY] })
        const variants = [Region.Cradle, Region.Provinces, Region.Hinterland].map((region) => ({
            modifiers: [observatory(region)]
        }))
        expect(read(searchRows(s, 'p1', [observatory(Region.Cradle)], variants))).toEqual([
            [SearchSource.Discard, Region.Provinces, 2, 3, 1]
        ])
    })
})
