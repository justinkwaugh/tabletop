import { describe, expect, it } from 'vitest'
import {
    StationPlacement,
    replacementMappings,
    rotateTileFace,
    type TileRotation
} from '@tabletop/18xx'
import { edit, opened, placeTile, type Table } from '../test/kit.js'
import { StationRules1880 } from './stations.js'
import { tileFace1880 } from './tiles.js'

/** Puts a tile on the QSR's home hex, its reservations following as the family maps them. */
function upgradeShenyang(game: Table, from: string, to: string, rotation: TileRotation) {
    const [mapping] = replacementMappings(
        tileFace1880(from),
        rotateTileFace(tileFace1880(to), rotation)
    )
    expect(mapping).toBeDefined()
    placeTile(game, 'D12', to, rotation)
    edit(game, (state) => {
        state.stationReservations = state.stationReservations.map((reservation) =>
            reservation.locationId === 'D12'
                ? { ...reservation, nodeId: mapping?.[reservation.nodeId] ?? reservation.nodeId }
                : reservation
        )
    })
}

const open = (game: Table, nodeId: string, companyId = 'BCR') =>
    new StationPlacement(game.hydrated, StationRules1880).openSlots(companyId, 'D12', nodeId)

describe('the QSR’s home before it is placed (§X; R61)', () => {
    it('closes both of its separate cities to other companies', () => {
        const game = opened(4, 3)
        upgradeShenyang(game, '1880:235', '1880:8862', 0)
        expect(open(game, 'city-0')).toEqual([])
        expect(open(game, 'city-1')).toEqual([])
    })

    it('keeps one space of the joined brown city for it, the other open', () => {
        const game = opened(4, 3)
        upgradeShenyang(game, '1880:8862', '1880:8872', 3)
        expect(
            game.state.stationReservations.filter((reservation) => reservation.locationId === 'D12')
        ).toEqual([
            { companyId: 'QSR', locationId: 'D12', nodeId: 'city' },
            { companyId: 'QSR', locationId: 'D12', nodeId: 'city' }
        ])
        // Either space is open to one other company; the other stays the QSR's.
        expect(open(game, 'city')).toHaveLength(2)
        edit(game, (state) => {
            const station = state.stations.find((entry) => entry.id === 'BCR:station:1')
            if (station)
                Object.assign(station, {
                    status: 'placed',
                    position: { locationId: 'D12', nodeId: 'city', slot: 0 }
                })
        })
        expect(open(game, 'city', 'NJR')).toEqual([])
        expect(open(game, 'city', 'QSR')).toEqual([1])
    })
})
