import { describe, expect, it } from 'vitest'
import {
    BOARD_GRID,
    PROMONTORY,
    RAILROAD_IDS,
    TOWN_TILE_KIND_IDS,
    ZERO_PRICE_SPACES,
    type RailroadId,
    type SpaceId,
    type TownTileKindId
} from '@tabletop/promontory-point'
import { BORDER_TRACK_SPACES, HEX } from './boardGeometry.js'
import {
    ChipPlacement,
    TOWN_TILE_SCALE,
    TRACK_PIECE_RADIUS,
    chipPlacement,
    endTrackerStatus,
    localHexPoints,
    moneyMarkers,
    priceMarkerSlot,
    seatInitials,
    townTileRotation,
    veilPath
} from './boardLayout.js'

const CP: RailroadId = 'railroad.cp'
const KP: RailroadId = 'railroad.kp'

function townsOf(kinds: [SpaceId, TownTileKindId][]): Record<SpaceId, TownTileKindId> {
    return Object.fromEntries(kinds)
}

describe('town tiles (R-1.3, O-6)', () => {
    it('O-6: turns the six number tiles a quarter turn and leaves the red tiles as supplied', () => {
        const turned = TOWN_TILE_KIND_IDS.filter((kindId) => townTileRotation(kindId) === 90)
        expect(turned).toEqual([
            'tile.price.plus-1',
            'tile.price.plus-2',
            'tile.price.plus-3',
            'tile.price.minus-1',
            'tile.price.minus-2',
            'tile.price.minus-3'
        ])
        expect(townTileRotation('tile.red.dividend')).toBe(0)
        expect(townTileRotation('tile.red.hammer')).toBe(0)
    })

    it('R-X.4, O-5: a track piece fits inside a town tile, so a covered red tile still reads', () => {
        const tileHex = localHexPoints(TOWN_TILE_SCALE)
        const tileInnerRadius = Math.max(...tileHex.map((point) => point.x))
        expect(tileInnerRadius).toBeLessThan(HEX.xRadius)
        expect(TRACK_PIECE_RADIUS).toBeLessThan(tileInnerRadius * 0.7)
    })
})

describe('veil (contract, "Pick conventions")', () => {
    it('is one path: the whole map and one hole per lit hex', () => {
        const lit: SpaceId[] = ['space.0.0', 'space.1.0', 'space.-6.5']
        const path = veilPath(lit)
        expect(path.match(/M/g)).toHaveLength(1 + lit.length)
        expect(path.match(/Z/g)).toHaveLength(1 + lit.length)
        expect(veilPath([]).match(/M/g)).toHaveLength(1)
    })
})

describe('price markers (R-1.2)', () => {
    it('gives each railroad its own slot on one value', () => {
        const slots = RAILROAD_IDS.map((railroadId) => priceMarkerSlot(railroadId, 9))
        expect(new Set(slots.map((slot) => slot.x)).size).toBe(RAILROAD_IDS.length)
        expect(new Set(slots.map((slot) => slot.y)).size).toBe(1)
    })

    it('keeps the five 0 spaces apart', () => {
        const zeros = Array.from({ length: ZERO_PRICE_SPACES }, (_, index) =>
            priceMarkerSlot(CP, index)
        )
        expect(new Set(zeros.map((slot) => `${slot.x},${slot.y}`)).size).toBe(ZERO_PRICE_SPACES)
    })
})

describe('money markers (R-1.3-H1)', () => {
    it('gives a seat alone its whole space', () => {
        const [marker] = moneyMarkers([
            { playerId: 'a', money: 24 },
            { playerId: 'b', money: 3 }
        ])
        expect(marker).toEqual({
            playerId: 'a',
            box: BORDER_TRACK_SPACES[24].box,
            shared: false,
            plus100: false
        })
    })

    it('shares a space as a 2×2 grid in seat order', () => {
        const markers = moneyMarkers([
            { playerId: 'a', money: 7 },
            { playerId: 'b', money: 12 },
            { playerId: 'c', money: 7 },
            { playerId: 'd', money: 107 }
        ])
        const quarters = BORDER_TRACK_SPACES[7].sharingSlots
        expect(markers.map((marker) => marker.box)).toEqual([
            quarters[0],
            BORDER_TRACK_SPACES[12].box,
            quarters[1],
            quarters[2]
        ])
        expect(markers.map((marker) => marker.shared)).toEqual([true, false, true, true])
    })

    it('wraps past 99 with a "+100" mark', () => {
        const [at100, at99, at123] = moneyMarkers([
            { playerId: 'a', money: 100 },
            { playerId: 'b', money: 99 },
            { playerId: 'c', money: 123 }
        ])
        expect(at100).toMatchObject({ box: BORDER_TRACK_SPACES[0].box, plus100: true })
        expect(at99).toMatchObject({ box: BORDER_TRACK_SPACES[99].box, plus100: false })
        expect(at123).toMatchObject({ box: BORDER_TRACK_SPACES[23].box, plus100: true })
    })
})

describe('end tracker (R-6.1, R-6.1-H1)', () => {
    const towns = townsOf([
        ['space.2.-6', 'tile.red.dividend'],
        ['space.4.-6', 'tile.red.hammer'],
        ['space.0.-5', 'tile.red.hammer'],
        ['space.2.-5', 'tile.price.plus-2']
    ])

    it('counts the red towns no piece covers and says Promontory is open', () => {
        expect(endTrackerStatus({ towns, track: { 'space.2.-6': CP, 'space.2.-5': KP } })).toEqual({
            redTownsOpen: 2,
            redTownsMet: false,
            promontoryTaken: false
        })
    })

    it('meets the red line at one open red town and reads Promontory taken from the board', () => {
        expect(
            endTrackerStatus({
                towns,
                track: { 'space.2.-6': CP, 'space.4.-6': KP, [PROMONTORY.spaceId]: KP }
            })
        ).toEqual({ redTownsOpen: 1, redTownsMet: true, promontoryTaken: true })
    })
})

describe('chips (O-3)', () => {
    const neighbour = (dq: number, dr: number): SpaceId => {
        const space = BOARD_GRID.space(`space.${dq}.${dr}`)
        expect(space, `space.${dq}.${dr}`).toBeDefined()
        return `space.${dq}.${dr}`
    }

    it('sits above its hex, below when a hex above is lit, inside when both rows are', () => {
        const hex: SpaceId = 'space.0.0'
        expect(chipPlacement(hex, [hex, neighbour(-1, 0)])).toBe(ChipPlacement.Above)
        expect(chipPlacement(hex, [hex, neighbour(1, -1)])).toBe(ChipPlacement.Below)
        expect(chipPlacement(hex, [hex, neighbour(0, -1), neighbour(0, 1)])).toBe(
            ChipPlacement.Inside
        )
    })
})

describe('initials (art plan, "Seat colours and colour blindness")', () => {
    it('marks a seat with its name’s first letters, at most two', () => {
        expect(seatInitials('Mara')).toBe('M')
        expect(seatInitials('Player 2')).toBe('P2')
        expect(seatInitials('ann marie lee')).toBe('AM')
    })
})
