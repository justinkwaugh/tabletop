import type { AxialCoordinates } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { BOARD_GRID, BoardNodeKind, PROMONTORY, spaceIdAt } from './board.js'
import {
    MAX_PRICE_INDEX,
    MIN_PRICE_INDEX,
    PRICE_INDICES,
    START_PRICE_INDEX,
    sharePriceAt
} from './priceTrack.js'
import { RAILROAD_IDS, RAILROADS, type RailroadId } from './railroads.js'
import { SHARE_KINDS, SHARES_PER_RAILROAD } from './shares.js'
import {
    RED_TILE_KIND_IDS,
    TOWN_TILE_KINDS,
    TownEventKind,
    isRedTile,
    type TownTileKindId
} from './townTiles.js'
import { TRACK_PIECE_KINDS, TRACK_PIECES_PER_RAILROAD } from './trackPieces.js'

function coords(list: [number, number][]): string[] {
    return list.map(([q, r]) => spaceIdAt({ q, r }))
}

function sorted(ids: string[]): string[] {
    return [...ids].sort()
}

const TOWNS = coords([
    [2, -6],
    [4, -6],
    [0, -5],
    [2, -5],
    [3, -5],
    [5, -5],
    [1, -4],
    [3, -4],
    [-1, -3],
    [4, -3],
    [-3, -2],
    [0, -2],
    [1, -2],
    [2, -2],
    [5, -2],
    [-5, -1],
    [-3, -1],
    [-1, -1],
    [2, -1],
    [4, -1],
    [6, -1],
    [-6, 0],
    [-5, 0],
    [-2, 0],
    [2, 0],
    [5, 0],
    [6, 0],
    [-6, 1],
    [-4, 1],
    [-2, 1],
    [1, 1],
    [3, 1],
    [5, 1],
    [-5, 2],
    [-2, 2],
    [-1, 2],
    [0, 2],
    [3, 2],
    [-4, 3],
    [1, 3],
    [-3, 4],
    [-1, 4],
    [-5, 5],
    [-3, 5],
    [-2, 5],
    [0, 5],
    [-4, 6],
    [-2, 6]
])

const EMPTY_SPACES = coords([
    [0, -6],
    [1, -6],
    [3, -6],
    [5, -6],
    [6, -6],
    [-1, -5],
    [1, -5],
    [4, -5],
    [6, -5],
    [-1, -4],
    [0, -4],
    [2, -4],
    [4, -4],
    [5, -4],
    [-3, -3],
    [-2, -3],
    [0, -3],
    [1, -3],
    [2, -3],
    [3, -3],
    [5, -3],
    [6, -3],
    [-4, -2],
    [-2, -2],
    [-1, -2],
    [3, -2],
    [4, -2],
    [6, -2],
    [-4, -1],
    [-2, -1],
    [0, -1],
    [1, -1],
    [3, -1],
    [5, -1],
    [-4, 0],
    [-3, 0],
    [-1, 0],
    [1, 0],
    [3, 0],
    [4, 0],
    [-5, 1],
    [-3, 1],
    [-1, 1],
    [0, 1],
    [2, 1],
    [4, 1],
    [-6, 2],
    [-4, 2],
    [-3, 2],
    [1, 2],
    [2, 2],
    [4, 2],
    [-6, 3],
    [-5, 3],
    [-3, 3],
    [-2, 3],
    [-1, 3],
    [0, 3],
    [2, 3],
    [3, 3],
    [-5, 4],
    [-4, 4],
    [-2, 4],
    [0, 4],
    [1, 4],
    [-4, 5],
    [-1, 5],
    [1, 5],
    [-6, 5],
    [-6, 6],
    [-5, 6],
    [-3, 6],
    [-1, 6],
    [0, 6]
])

const HOME_NEIGHBOURS: Record<RailroadId, string[]> = {
    'railroad.cp': coords([
        [-1, -4],
        [-2, -3],
        [-1, -5],
        [-3, -3]
    ]),
    'railroad.up': coords([
        [5, -4],
        [6, -3],
        [6, -5],
        [5, -3]
    ]),
    'railroad.kp': coords([
        [1, 4],
        [2, 3],
        [3, 3],
        [1, 5]
    ]),
    'railroad.sp': coords([
        [-5, 4],
        [-6, 5],
        [-6, 3],
        [-5, 3]
    ])
}

function spaceIdsOfKind(kind: BoardNodeKind): string[] {
    return BOARD_GRID.spaces()
        .filter((space) => space.kind === kind)
        .map((space) => space.spaceId)
}

describe('railroads, shares and track pieces', () => {
    it('R-0, R-1.1: four railroads with their printed names and home hexes', () => {
        expect(RAILROAD_IDS).toEqual(['railroad.cp', 'railroad.up', 'railroad.kp', 'railroad.sp'])
        expect(Object.keys(RAILROADS)).toEqual(RAILROAD_IDS)
        expect(RAILROAD_IDS.map((id) => RAILROADS[id].name)).toEqual([
            'Central Pacific',
            'Union Pacific',
            'Kansas Pacific',
            'Southern Pacific'
        ])
        const homes: Record<RailroadId, AxialCoordinates> = {
            'railroad.cp': { q: -2, r: -4 },
            'railroad.up': { q: 6, r: -4 },
            'railroad.kp': { q: 2, r: 4 },
            'railroad.sp': { q: -6, r: 4 }
        }
        for (const id of RAILROAD_IDS) {
            expect(RAILROADS[id].id).toBe(id)
            expect(RAILROADS[id].homeHex).toEqual(homes[id])
        }
    })

    it('R-1.1: 11 shares of each railroad, 44 in all', () => {
        expect(SHARES_PER_RAILROAD).toBe(11)
        const kinds = Object.values(SHARE_KINDS)
        expect(Object.keys(SHARE_KINDS)).toEqual(['share.cp', 'share.up', 'share.kp', 'share.sp'])
        expect(kinds.map((kind) => kind.railroadId)).toEqual(RAILROAD_IDS)
        expect(kinds.reduce((total, kind) => total + kind.count, 0)).toBe(44)
    })

    it('R-1.1: 24 track pieces of each railroad, 96 in all', () => {
        expect(TRACK_PIECES_PER_RAILROAD).toBe(24)
        const kinds = Object.values(TRACK_PIECE_KINDS)
        expect(Object.keys(TRACK_PIECE_KINDS)).toEqual([
            'marker.cp',
            'marker.up',
            'marker.kp',
            'marker.sp'
        ])
        expect(kinds.map((kind) => kind.railroadId)).toEqual(RAILROAD_IDS)
        expect(kinds.reduce((total, kind) => total + kind.count, 0)).toBe(96)
    })

    it('every component id is unique and matches its key', () => {
        const records = [RAILROADS, SHARE_KINDS, TRACK_PIECE_KINDS, TOWN_TILE_KINDS]
        const ids = records.flatMap((record) =>
            Object.entries(record).map(([key, component]) => {
                expect(component.id).toBe(key)
                return key
            })
        )
        const spaceIds = BOARD_GRID.spaces().map((space) => space.spaceId)
        const all = [...ids, ...spaceIds]
        expect(new Set(all).size).toBe(all.length)
    })
})

describe('town tiles', () => {
    it('R-1.1-H1: 48 tiles, +1 ×5, +2 ×8, +3 ×6, −1 ×3, −2 ×6, −3 ×4, Dividend ×8, Repairs ×8', () => {
        const counts: Record<TownTileKindId, number> = {
            'tile.price.plus-1': 5,
            'tile.price.plus-2': 8,
            'tile.price.plus-3': 6,
            'tile.price.minus-1': 3,
            'tile.price.minus-2': 6,
            'tile.price.minus-3': 4,
            'tile.red.dividend': 8,
            'tile.red.hammer': 8
        }
        const kinds = Object.values(TOWN_TILE_KINDS)
        expect(Object.fromEntries(kinds.map((kind) => [kind.id, kind.count]))).toEqual(counts)
        expect(kinds.reduce((total, kind) => total + kind.count, 0)).toBe(48)
    })

    it('R-4.2: the price tiles move the price by their printed value', () => {
        const changes = Object.values(TOWN_TILE_KINDS).flatMap((kind) =>
            kind.event.kind === TownEventKind.PriceChange ? [[kind.id, kind.event.priceChange]] : []
        )
        expect(Object.fromEntries(changes)).toEqual({
            'tile.price.plus-1': 1,
            'tile.price.plus-2': 2,
            'tile.price.plus-3': 3,
            'tile.price.minus-1': -1,
            'tile.price.minus-2': -2,
            'tile.price.minus-3': -3
        })
    })

    it('R-0-H1, R-4.2: the red tiles are named Dividend and Repairs, $2 per share each', () => {
        const dividend = TOWN_TILE_KINDS['tile.red.dividend']
        const repairs = TOWN_TILE_KINDS['tile.red.hammer']
        expect(dividend.name).toBe('Dividend')
        expect(dividend.event).toEqual({ kind: TownEventKind.Dividend, dollarsPerShare: 2 })
        expect(repairs.name).toBe('Repairs')
        expect(repairs.event).toEqual({ kind: TownEventKind.Repairs, dollarsPerShare: 2 })
    })

    it('R-6.1-H1: the red tiles are exactly Dividend and Repairs, 16 in all', () => {
        expect(RED_TILE_KIND_IDS).toEqual(['tile.red.dividend', 'tile.red.hammer'])
        const red = Object.values(TOWN_TILE_KINDS).filter((kind) => isRedTile(kind.id))
        expect(red.map((kind) => kind.id)).toEqual(RED_TILE_KIND_IDS)
        expect(red.reduce((total, kind) => total + kind.count, 0)).toBe(16)
    })
})

describe('the board', () => {
    it('R-1.1-H3: 123 spaces, 48 towns, 74 empty spaces and Promontory, with unique ids', () => {
        const ids = BOARD_GRID.spaces().map((space) => space.spaceId)
        expect(ids).toHaveLength(123)
        expect(new Set(ids).size).toBe(123)
        expect(sorted(spaceIdsOfKind(BoardNodeKind.Town))).toEqual(sorted(TOWNS))
        expect(sorted(spaceIdsOfKind(BoardNodeKind.Empty))).toEqual(sorted(EMPTY_SPACES))
        expect(spaceIdsOfKind(BoardNodeKind.Promontory)).toEqual(['space.0.0'])
    })

    it('R-1.1-H3: the coastal hex space.-6.5 is an empty space', () => {
        expect(BOARD_GRID.requireSpace('space.-6.5').kind).toBe(BoardNodeKind.Empty)
    })

    it('R-4.2: Promontory, space.0.0, moves the price +5', () => {
        expect(PROMONTORY.spaceId).toBe('space.0.0')
        expect(PROMONTORY.event).toEqual({ kind: TownEventKind.PriceChange, priceChange: 5 })
        expect(BOARD_GRID.requireSpace('space.0.0').coords).toEqual({ q: 0, r: 0 })
    })

    it('R-0: no home hex is a space', () => {
        for (const id of RAILROAD_IDS) {
            const home = BOARD_GRID.homeHex(id)
            expect(home.kind).toBe(BoardNodeKind.Home)
            expect(home.coords).toEqual(RAILROADS[id].homeHex)
            expect(BOARD_GRID.space(spaceIdAt(home.coords))).toBeUndefined()
        }
        expect(BOARD_GRID.homeHexes()).toHaveLength(4)
    })

    it('R-1.1-H3: each home hex touches exactly four spaces', () => {
        for (const id of RAILROAD_IDS) {
            const touching = BOARD_GRID.spacesAdjacentTo(RAILROADS[id].homeHex)
            expect(sorted(touching.map((space) => space.spaceId))).toEqual(
                sorted(HOME_NEIGHBOURS[id])
            )
        }
    })

    it('R-1.1: adjacency follows the pointy-top axial grid', () => {
        const neighbours = BOARD_GRID.spacesAdjacentTo({ q: 0, r: 0 }).map((space) => space.spaceId)
        expect(sorted(neighbours)).toEqual(
            sorted([
                'space.1.0',
                'space.-1.0',
                'space.0.1',
                'space.0.-1',
                'space.1.-1',
                'space.-1.1'
            ])
        )
    })

    it('R-1.1: all 123 spaces form one connected graph', () => {
        const [first] = BOARD_GRID.spaces()
        const reached = new Set([first.spaceId])
        const frontier = [first]
        while (frontier.length > 0) {
            const space = frontier.pop()
            if (!space) {
                break
            }
            for (const neighbour of BOARD_GRID.spacesAdjacentTo(space.coords)) {
                if (!reached.has(neighbour.spaceId)) {
                    reached.add(neighbour.spaceId)
                    frontier.push(neighbour)
                }
            }
        }
        expect(reached.size).toBe(123)
    })
})

describe('the share-price track', () => {
    it('R-1.2: 30 indices; 0–4 are price 0, index i ≥ 5 is price i − 4, index 29 is 25', () => {
        expect(PRICE_INDICES).toEqual(Array.from({ length: 30 }, (_, index) => index))
        expect(MIN_PRICE_INDEX).toBe(0)
        expect(MAX_PRICE_INDEX).toBe(29)
        for (const index of [0, 1, 2, 3, 4]) {
            expect(sharePriceAt(index)).toBe(0)
        }
        for (const index of PRICE_INDICES.filter((index) => index >= 5)) {
            expect(sharePriceAt(index)).toBe(index - 4)
        }
        expect(sharePriceAt(29)).toBe(25)
    })

    it('R-1.2, R-1.3: every railroad starts at index 9, price 5', () => {
        expect(START_PRICE_INDEX).toBe(9)
        expect(sharePriceAt(START_PRICE_INDEX)).toBe(5)
    })
})
