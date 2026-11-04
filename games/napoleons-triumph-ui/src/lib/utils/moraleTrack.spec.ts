import { describe, expect, it } from 'vitest'
import {
    Side,
    SideSelection,
    type HydratedNapoleonsTriumphPlayerState
} from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { onBattlefield } from '$lib/map/battlefield.js'
import { GuardMark, moraleMarkers } from './moraleTrack.js'
import { MORALE_MARKER_RADIUS, MORALE_MARKER_SHARED_OFFSET } from './trackMarker.js'

const NORTH_UP = 0
const FROM_THE_FRENCH_LINES = -90

function markersAt(levels: Record<Side, number>, rotation = NORTH_UP) {
    const game = new TestGame()
    game.arrange((state) => {
        for (const player of state.players) {
            player.morale = levels[state.sideOf(player.playerId)]
        }
    })
    const markers = moraleMarkers(game.hydrated, rotation)
    return (side: Side) => markers.find((marker) => marker.playerId === game.playerOf(side))?.at
}

function standing(side: Side, levels: Record<Side, number>, rotation = NORTH_UP) {
    const at = markersAt(levels, rotation)(side)
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
        expect(moraleMarkers(game.hydrated, NORTH_UP)).toEqual([])
    })

    it('start on the two start boxes, four apart in one row', () => {
        const [first, second] = moraleMarkers(new TestGame().hydrated, NORTH_UP)
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

    it('cover most of the box their level is printed in', () => {
        expect(2 * MORALE_MARKER_RADIUS).toBeGreaterThan(
            0.6 * (standingAt(26).x - standingAt(27).x)
        )
        expect(2 * MORALE_MARKER_RADIUS).toBeLessThan(standingAt(26).x - standingAt(27).x)
    })

    it("stand side by side across the viewer's screen when the armies share a box, the French on the left", () => {
        const shared = { [Side.Allied]: 14, [Side.French]: 14 }
        const box = standingAt(14)
        const allied = standing(Side.Allied, shared)
        const french = standing(Side.French, shared)
        expect(allied.y).toBe(box.y)
        expect(french.y).toBe(box.y)
        expect(allied.x - french.x).toBeCloseTo(2 * MORALE_MARKER_SHARED_OFFSET)
        expect((allied.x + french.x) / 2).toBeCloseTo(box.x)

        const turnedAllied = standing(Side.Allied, shared, FROM_THE_FRENCH_LINES)
        const turnedFrench = standing(Side.French, shared, FROM_THE_FRENCH_LINES)
        expect(turnedAllied.x).toBe(box.x)
        expect(turnedFrench.x).toBe(box.x)
        expect(turnedAllied.y - turnedFrench.y).toBeCloseTo(2 * MORALE_MARKER_SHARED_OFFSET)
    })

    it('are centred on their box when the armies stand apart, whichever way the board is turned', () => {
        const apart = { [Side.Allied]: 14, [Side.French]: 9 }
        expect(standing(Side.Allied, apart, FROM_THE_FRENCH_LINES)).toEqual(standingAt(14))
    })

    it('leave the track when an army breaks', () => {
        const at = markersAt({ [Side.Allied]: 0, [Side.French]: 5 })
        expect(at(Side.Allied)).toBeUndefined()
        expect(at(Side.French)).toBeDefined()
    })
})

describe('elite commitments on the morale markers', () => {
    function markerOf(side: Side, edit: (player: HydratedNapoleonsTriumphPlayerState) => void) {
        const game = new TestGame()
        game.arrange((state) => edit(state.playerOf(side)))
        const marker = moraleMarkers(game.hydrated, NORTH_UP).find(
            ({ playerId }) => playerId === game.playerOf(side)
        )
        if (!marker) {
            throw new Error(`Expected the ${side} marker on the track`)
        }
        return marker
    }

    it('show nothing before either is committed', () => {
        const marker = markerOf(Side.French, () => {})
        expect(marker.heavyCavalryCommitted).toBe(false)
        expect(marker.guard).toBeUndefined()
    })

    it("show each army's own commitments", () => {
        const french = markerOf(Side.French, (player) => {
            player.heavyCavalryCommitted = true
        })
        expect(french.heavyCavalryCommitted).toBe(true)
        expect(french.guard).toBeUndefined()
        expect(
            markerOf(Side.Allied, (player) => {
                player.guardCommitted = true
            }).guard
        ).toBe(GuardMark.Committed)
    })

    it('mark the Guard failed once its attack has been defeated', () => {
        const allied = markerOf(Side.Allied, (player) => {
            player.guardCommitted = true
            player.guardAttackForfeited = true
        })
        expect(allied.guard).toBe(GuardMark.Failed)
    })
})
