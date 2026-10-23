import { describe, expect, it } from 'vitest'
import { CAMPAIGN, FOOTFALL, VOYAGES, systemsInSectors } from '@tabletop/stellar-horizons-2'
import { BoardTurn, boardLayout, boardTurnFor } from './boardLayout.js'

const LANDSCAPE = { width: 1500, height: 700 }
const PORTRAIT = { width: 400, height: 700 }

function systemIds(sectors: typeof CAMPAIGN.sectors): string[] {
    return systemsInSectors(sectors).map((system) => system.id)
}

describe('the board’s turn', () => {
    // Turned, the campaign's board is as wide and taller, and Voyages' is larger both ways, so
    // neither is ever drawn larger turned.
    it('keeps the campaign and Voyages as printed on any screen', () => {
        for (const ids of [systemIds(CAMPAIGN.sectors), systemIds(VOYAGES.sectors)]) {
            expect(boardTurnFor(ids, LANDSCAPE)).toBe(BoardTurn.Printed)
            expect(boardTurnFor(ids, PORTRAIT)).toBe(BoardTurn.Printed)
        }
        const printed = boardLayout(systemIds(CAMPAIGN.sectors), BoardTurn.Printed)
        expect(printed.width).toBeGreaterThan(printed.height)
    })

    it('turns Footfall’s tall strip on a wide screen and keeps it on a tall one', () => {
        const footfall = systemIds(FOOTFALL.sectors)
        expect(boardTurnFor(footfall, LANDSCAPE)).toBe(BoardTurn.Sixty)
        expect(boardTurnFor(footfall, PORTRAIT)).toBe(BoardTurn.Printed)
    })
})
