import { describe, expect, it } from 'vitest'
import { RailwayMapState, rotateTileFace } from '@tabletop/18xx'
import { edit, opened, type Table } from '../test/kit.js'
import { Map1861 } from './map.js'
import type { State1861 } from './state.js'
import { StationRules1861, hexDistance1861, majorStartHomes1861 } from './stations.js'
import { TileSet1861 } from './tiles.js'

// Nizhnii Novgorod's printed track leads into J8, a plain hex, by its side 4.
const Novgorod = 'K7'
const Beyond = 'J8'
const BeyondSide = 4

/** Lays a tile in a hex so that its track meets the given side. */
function lay(state: State1861, locationId: string, definitionId: string, side: number): void {
    const [piece] = TileSet1861.availablePieces(state.tileInventory, definitionId)
    if (!piece) throw new Error(`No ${definitionId} left`)
    for (const rotation of [0, 1, 2, 3, 4, 5] as const) {
        state.tileInventory.placements[locationId] = { pieceId: piece.id, definitionId, rotation }
        const tile = new RailwayMapState(Map1861, TileSet1861, state.tileInventory).tile(locationId)
        const meets = rotateTileFace(tile.face, tile.rotation).paths.some((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && end.edge === side)
        )
        if (meets) return
    }
    throw new Error(`${definitionId} cannot meet side ${side}`)
}

const homes = (game: Table) =>
    majorStartHomes1861(game.state, 'MK').map((home) => `${home.locationId} ${home.nodeId}`)

describe('1861 public company homes (§9.3)', () => {
    it('offers open cities with no track to another stop, and no reserved city', () => {
        const game = opened(3)
        expect(homes(game)).toEqual(expect.arrayContaining(['K7 city', 'M7 city']))
        expect(homes(game).filter((home) => home.startsWith('H8'))).toEqual([])
    })

    it('refuses a city once its track reaches a town', () => {
        const game = opened(3)
        expect(homes(game)).toContain('K7 city')
        edit(game, (state) => lay(state, Beyond, '18xx:4', BeyondSide))
        expect(homes(game)).not.toContain('K7 city')
    })

    it('refuses a city whose track ends at a city full of others’ stations', () => {
        const game = opened(3)
        edit(game, (state) => {
            lay(state, Beyond, '18xx:57', BeyondSide)
            state.stations = state.stations.map((station) =>
                station.id === 'GRR:home'
                    ? {
                          ...station,
                          status: 'placed',
                          position: { locationId: Beyond, nodeId: 'city', slot: 0 }
                      }
                    : station
            )
        })
        expect(homes(game)).not.toContain(`${Novgorod} city`)
        expect(homes(game)).not.toContain(`${Beyond} city`)
    })

    it('refuses two open cities whose track joins only each other', () => {
        const game = opened(3)
        edit(game, (state) => lay(state, Beyond, '18xx:57', BeyondSide))
        expect(homes(game)).not.toContain(`${Novgorod} city`)
        expect(homes(game)).not.toContain(`${Beyond} city`)
    })

    describe('station costs (§10.5)', () => {
        const rates = (game: Table, companyId: string) =>
            game.state.stations
                .filter(
                    (station) => station.companyId === companyId && station.status === 'available'
                )
                .map((station) => StationRules1861.placementCost(game.state, station.id))

        it('shows each unplaced station at its own rate: free, then R20 and R40 a hex', () => {
            const game = opened(3)
            expect(rates(game, 'MK')).toEqual([0, 20, 40])
            edit(game, (state) => {
                state.stations = state.stations.map((station) =>
                    station.id === 'MK:home'
                        ? {
                              ...station,
                              status: 'placed',
                              position: { locationId: 'M7', nodeId: 'city', slot: 0 }
                          }
                        : station
                )
            })
            expect(rates(game, 'MK')).toEqual([20, 40])
            // The state railway's and the minors' stations cost nothing.
            expect(rates(game, 'RSR').every((rate) => rate === 0)).toBe(true)
            expect(rates(game, 'N')).toEqual([0])
        })

        it('charges the next station R20 a hex from the first, whichever marker is placed', () => {
            const game = opened(3)
            edit(game, (state) => {
                state.stations = state.stations.map((station) =>
                    station.id === 'MK:home'
                        ? {
                              ...station,
                              status: 'placed',
                              position: { locationId: 'M7', nodeId: 'city', slot: 0 }
                          }
                        : station
                )
            })
            const at = { locationId: 'L12', nodeId: 'city', slot: 0 }
            const cost = (stationId: string) =>
                StationRules1861.placementCost(game.state, stationId, {
                    companyId: 'MK',
                    stationId,
                    position: at,
                    connected: true
                })
            expect(cost('MK:station:1')).toBe(20 * hexDistance1861('M7', 'L12'))
            expect(cost('MK:station:2')).toBe(20 * hexDistance1861('M7', 'L12'))
        })
    })
})
