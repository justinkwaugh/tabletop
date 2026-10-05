import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { FACTIONS, factionShips, type ShipState } from '@tabletop/stellar-horizons-2'
import { BOARD_CELL, boardLayout } from './boardLayout.js'
import { baseTabLayout, type TabBase } from './baseTabLayout.js'
import { shipPipLayout } from './shipPipLayout.js'
import { boxesOverlap, distanceToBox, printedText } from './tileFeatures.js'

const SETTLED_SYSTEMS = [
    'v2306-ophiuchi',
    'barnards-star',
    'wise-0855-0714',
    'procyon',
    'gliese-876',
    'luhman-16',
    'alpha-centauri',
    'sirius'
]
const frames = boardLayout(['sol', ...SETTLED_SYSTEMS]).frames.filter(
    (frame) => frame.systemId !== 'sol'
)

function bases(counts: number[]): TabBase[] {
    return counts.map((settlements, index) => ({
        playerId: `p${index}`,
        faction: FACTIONS[index].faction,
        settlements,
        winning: false
    }))
}

function edgeX(y: number): number {
    return BOARD_CELL.xRadius - (Math.abs(y) / BOARD_CELL.yRadius) * (BOARD_CELL.xRadius / 2)
}

describe('base tab layout', () => {
    it.each(frames.map((frame) => [frame.systemId, frame] as const))(
        'stacks six bases down one edge at %s without wrapping a corner or covering the tile',
        (_, frame) => {
            const tabs = baseTabLayout(frame, bases([57, 14, 3, 10, 22, 1]))
            expect(tabs).toHaveLength(6)
            const sides = new Set(tabs.map((tab) => Math.sign(tab.label.x)))
            const halves = new Set(tabs.map((tab) => Math.sign(tab.box.top + tab.box.bottom)))
            expect(sides.size).toBe(1)
            expect(halves.size).toBe(1)
            for (const [index, tab] of tabs.entries()) {
                for (const slot of frame.slots) {
                    expect(distanceToBox(slot, tab.box)).toBeGreaterThanOrEqual(56)
                }
                expect(printedText(frame).some((text) => boxesOverlap(text, tab.box))).toBe(false)
                for (const other of tabs.slice(0, index)) {
                    expect(boxesOverlap(other.box, tab.box)).toBe(false)
                }
            }
        }
    )

    it('attaches each tab to the seam along the edge', () => {
        const frame = frames.find((candidate) => candidate.systemId === 'alpha-centauri')
        assertExists(frame, 'Alpha Centauri is on the board')
        for (const tab of baseTabLayout(frame, bases([57, 14, 3]))) {
            const outer = tab.points.reduce((best, point) =>
                Math.abs(point.x) > Math.abs(best.x) ? point : best
            )
            expect(Math.abs(outer.x)).toBeCloseTo(edgeX(outer.y))
        }
    })

    it('keeps ships clear of the bases', () => {
        const ships: ShipState[][] = FACTIONS.slice(0, 3).map(({ faction }, factionIndex) =>
            factionShips(faction)
                .slice(0, 3)
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
        for (const frame of frames) {
            const tabs = baseTabLayout(frame, bases([57, 14, 3, 10]))
            const layout = shipPipLayout(
                frame,
                ships,
                tabs.map((tab) => tab.box)
            )
            for (const pip of layout.pips) {
                for (const tab of tabs) {
                    expect(distanceToBox(pip, tab.box)).toBeGreaterThan(layout.radius)
                }
            }
        }
    })
})
