import { describe, expect, it } from 'vitest'
import { Side, SideSelection } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { onBattlefield } from '$lib/map/battlefield.js'
import { moraleMarkers } from './moraleTrack.js'
import { TRACK_MARKER_RADIUS } from './trackMarker.js'

function markersAt(levels: Record<Side, number>) {
    const game = new TestGame()
    game.arrange((state) => {
        for (const player of state.players) {
            player.morale = levels[state.sideOf(player.playerId)]
        }
    })
    const markers = moraleMarkers(game.hydrated)
    return (side: Side) => markers.find((marker) => marker.playerId === game.playerOf(side))?.at
}

function standing(side: Side, levels: Record<Side, number>) {
    const at = markersAt(levels)(side)
    if (!at) {
        throw new Error(`Expected the ${side} marker on the track`)
    }
    return at
}

function standingAt(level: number) {
    return standing(Side.Allied, { [Side.Allied]: level, [Side.French]: level === 1 ? 2 : 1 })
}

describe('markers on the morale track', () => {
    it('are absent until the armies are chosen', () => {
        const game = new TestGame({ sideSelection: SideSelection.Auction })
        expect(moraleMarkers(game.hydrated)).toEqual([])
    })

    it('start on the two start boxes, four apart in one row', () => {
        const [first, second] = moraleMarkers(new TestGame().hydrated)
        expect(first.at.y).toBe(second.at.y)
        expect(Math.abs(first.at.x - second.at.x)).toBeCloseTo(
            4 * (standingAt(26).x - standingAt(27).x)
        )
    })

    it('step along a row of nine and begin the next row under its first box', () => {
        expect(standingAt(26).x).toBeGreaterThan(standingAt(27).x)
        expect(standingAt(26).y).toBe(standingAt(27).y)
        expect(standingAt(19).x).toBeGreaterThan(standingAt(20).x)
        expect(standingAt(18).x).toBe(standingAt(27).x)
        expect(standingAt(9).x).toBe(standingAt(27).x)
        expect(standingAt(18).y).toBeLessThan(standingAt(27).y)
        expect(standingAt(9).y).toBeLessThan(standingAt(18).y)
    })

    it('have a box each for every level, all off the battlefield', () => {
        const places = Array.from({ length: 27 }, (_, index) => standingAt(index + 1))
        expect(new Set(places.map((place) => `${place.x}:${place.y}`)).size).toBe(27)
        for (const place of places) {
            expect(onBattlefield(place)).toBe(false)
        }
    })

    it('stand side by side when the armies share a box', () => {
        const shared = { [Side.Allied]: 14, [Side.French]: 14 }
        const allied = standing(Side.Allied, shared)
        const french = standing(Side.French, shared)
        expect(allied.x).toBe(standingAt(14).x)
        expect(french.x).toBe(allied.x)
        expect(Math.abs(allied.y - french.y)).toBeGreaterThan(2 * TRACK_MARKER_RADIUS)
        expect((allied.y + french.y) / 2).toBeCloseTo(standingAt(14).y)
    })

    it('leave the track when an army breaks', () => {
        const at = markersAt({ [Side.Allied]: 0, [Side.French]: 5 })
        expect(at(Side.Allied)).toBeUndefined()
        expect(at(Side.French)).toBeDefined()
    })
})
