import { describe, expect, it } from 'vitest'
import { FACTIONS, factionShips, type ShipState } from '@tabletop/stellar-horizons-2'
import { boardLayout } from './boardLayout.js'
import { LARGEST_PIP_RADIUS, honeycomb, shipPipLayout } from './shipPipLayout.js'

const FOOTFALL_SYSTEMS = [
    'sol',
    'v2306-ophiuchi',
    'barnards-star',
    'wise-0855-0714',
    'procyon',
    'gliese-876',
    'luhman-16',
    'alpha-centauri',
    'sirius'
]
const frames = boardLayout(FOOTFALL_SYSTEMS).frames

function fleets(factionCount: number, shipsEach: number): ShipState[][] {
    return FACTIONS.slice(0, factionCount).map(({ faction }, factionIndex) =>
        factionShips(faction)
            .slice(0, shipsEach)
            .map((ship) => ({
                shipId: ship.id,
                playerId: `p${factionIndex}`,
                systemId: 'x',
                transit: 0,
                damage: 0,
                settlements: 0,
                loadedFromBase: false,
                explored: false
            }))
    )
}

describe('ship pip layout', () => {
    it.each(frames.map((frame) => [frame.systemId, frame] as const))(
        'keeps large pips for the usual few ships of a few factions at %s',
        (_, frame) => {
            expect(shipPipLayout(frame, fleets(1, 1)).radius).toBe(LARGEST_PIP_RADIUS)
            expect(shipPipLayout(frame, fleets(1, 2)).radius).toBeGreaterThan(
                LARGEST_PIP_RADIUS * 0.85
            )
            const layout = shipPipLayout(frame, fleets(3, 3))
            expect(layout.pips).toHaveLength(9)
            expect(layout.radius).toBeGreaterThan(LARGEST_PIP_RADIUS * 0.5)
        }
    )

    it.each(frames.map((frame) => [frame.systemId, frame] as const))(
        'still places every ship of six crowded factions at %s',
        (_, frame) => {
            const layout = shipPipLayout(frame, fleets(6, 8))
            expect(layout.pips).toHaveLength(48)
            expect(layout.radius).toBeLessThan(LARGEST_PIP_RADIUS)
        }
    )

    it('never covers a world slot and never overlaps another pip', () => {
        for (const frame of frames) {
            const { pips, radius } = shipPipLayout(frame, fleets(4, 5))
            for (const pip of pips) {
                for (const slot of frame.slots) {
                    expect(Math.hypot(pip.x - slot.x, pip.y - slot.y)).toBeGreaterThan(radius + 50)
                }
                for (const other of pips) {
                    if (other !== pip) {
                        expect(Math.hypot(pip.x - other.x, pip.y - other.y)).toBeGreaterThanOrEqual(
                            radius * 2
                        )
                    }
                }
            }
        }
    })

    it('keeps each faction together as one clump', () => {
        const frame = frames.find((candidate) => candidate.systemId === 'alpha-centauri')
        if (!frame) throw new Error('Alpha Centauri is on the Footfall board')
        const { pips, radius } = shipPipLayout(frame, fleets(2, 3))
        const clump = (playerId: string) => pips.filter((pip) => pip.ship.playerId === playerId)
        const spread = (members: typeof pips) =>
            Math.max(
                ...members.flatMap((a) => members.map((b) => Math.hypot(a.x - b.x, a.y - b.y)))
            )
        expect(spread(clump('p0'))).toBeLessThan(radius * 2.2 * 1.5)
        expect(spread(clump('p1'))).toBeLessThan(radius * 2.2 * 1.5)
    })

    it('centres a honeycomb clump on its own middle', () => {
        for (const count of [1, 2, 3, 7]) {
            const cells = honeycomb(count, 10)
            expect(cells.reduce((sum, cell) => sum + cell.x, 0)).toBeCloseTo(0)
            expect(cells.reduce((sum, cell) => sum + cell.y, 0)).toBeCloseTo(0)
        }
    })
})
