import { describe, expect, it } from 'vitest'
import { CAMPAIGN, FOOTFALL, VOYAGES, systemsInSectors } from '@tabletop/stellar-horizons-2'
import { BoardTurn, boardLayout, boardTurnFor } from './boardLayout.js'
import { DEMAND_SIZE, WORLD_SIZE, distanceToBox, printedText } from './tileFeatures.js'

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

describe('the demand marker’s place', () => {
    it('is inside every tile, clear of its world slots and printed text', () => {
        const radius = DEMAND_SIZE / 2
        for (const frame of boardLayout(systemIds(CAMPAIGN.sectors), BoardTurn.Printed).frames) {
            const { x, y } = frame.demand
            const halfWidth =
                frame.width / 2 - (frame.width / 4) * (Math.abs(y) / (frame.height / 2))
            expect(Math.abs(x) + radius, frame.systemId).toBeLessThan(halfWidth)
            expect(Math.abs(y) + radius, frame.systemId).toBeLessThan(frame.height / 2)
            for (const slot of frame.slots) {
                expect(Math.hypot(slot.x - x, slot.y - y), frame.systemId).toBeGreaterThan(
                    WORLD_SIZE / 2 + radius
                )
            }
            for (const box of printedText(frame)) {
                expect(distanceToBox(frame.demand, box), frame.systemId).toBeGreaterThan(radius)
            }
        }
    })
})
