import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, privatePowerUsed, privateTrackConstruction } from '@tabletop/18xx'
import { edit, floatCompany, kit, opened } from '../test/kit.js'
import { movableStations, rebellionDestinations, rebellionMover } from './nwr.js'
import { neutralStationId } from './neutralStations.js'
import { PrivatePowerRules1882 } from './privatePowers.js'
import type { State1882 } from './state.js'
import { TrackRules1882 } from './track.js'

/** The Canadian Northern's first turn, owning the North-West Rebellion Company. */
function northernWithRebellion() {
    const game = opened(4)
    floatCompany(game, 'CNoR')
    kit.passStockRound(game)
    edit(game, (state) => {
        const certificate = state.certificates.find((entry) => entry.companyId === 'NWR')
        if (certificate) certificate.owner = { kind: 'company', companyId: 'CNoR' }
    })
    return game
}

describe('1882 North-West Rebellion Company', () => {
    it('moves a home station to a rebellion city, leaving a neutral station, then lays a tile there (§7.1.3)', () => {
        const game = northernWithRebellion()
        expect(game.valid()).toContain('MoveRebellionStation')
        expect(movableStations(game.state, 'CNoR').map((station) => station.id)).toEqual([
            'CNoR:home'
        ])
        const destination = rebellionDestinations(game.state, 'CNoR').find(
            (position) => position.locationId === 'C3'
        )
        game.act('MoveRebellionStation', { stationId: 'CNoR:home', position: destination })
        expect(game.state.stations.find((station) => station.id === 'CNoR:home')).toMatchObject({
            position: { locationId: 'C3' }
        })
        expect(
            game.state.stations.find((station) => station.id === neutralStationId())
        ).toMatchObject({ status: 'placed', position: { locationId: 'D8' } })
        // The extra lay waits on the destination hex.
        expect(game.state.privateTrackLay).toEqual({
            privateCompanyId: 'NWR',
            playerId: game.player,
            locationId: 'C3'
        })
        const terms = PrivatePowerRules1882.trackTerms(game.hydrated, 'NWR', game.player)
        if (!terms) throw new Error('The extra lay is on offer')
        const [lay] = privateTrackConstruction(game.hydrated, terms, TrackRules1882).choices('C3')
        const cash = finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'CNoR' })
        game.act('LayPrivateTile', {
            privateCompanyId: 'NWR',
            companyId: 'CNoR',
            locationId: 'C3',
            definitionId: lay.definitionId,
            rotation: lay.rotation,
            nodeMapping: lay.nodeMapping,
            expectedCost: lay.cost
        })
        // A yellow tile in a rebellion hex earns $20, the extra lay included.
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'CNoR' })).toBe(
            cash - lay.cost + 20
        )
        expect(privatePowerUsed(game.state, 'NWR')).toBe(true)
        expect(game.state.privateTrackLay).toBeUndefined()
        // The ordinary lays are still the company's.
        expect(game.state.trackStep?.lays).toEqual([])
    })

    it('moves no station already in a rebellion hex, nor a home sharing its hex with a neutral station (§7.1.3)', () => {
        const game = northernWithRebellion()
        const place = (stationId: string, locationId: string, nodeId: string) =>
            edit(game, (state) => {
                state.stations = state.stations.map((station) =>
                    station.id === stationId
                        ? {
                              ...station,
                              status: 'placed',
                              position: { locationId, nodeId, slot: 0 }
                          }
                        : station
                )
            })
        place('CNoR:home', 'C3', 'city')
        expect(movableStations(game.state, 'CNoR')).toEqual([])
        place('CNoR:home', 'J10', 'city-0')
        expect(movableStations(game.state, 'CNoR')).toHaveLength(1)
        place(neutralStationId('GTP'), 'J10', 'city-1')
        expect(movableStations(game.state, 'CNoR')).toEqual([])
        expect(game.valid()).not.toContain('MoveRebellionStation')
    })

    it('may decline the extra lay, which uses the power (§7.1.3)', () => {
        const game = northernWithRebellion()
        const destination = rebellionDestinations(game.state, 'CNoR').find(
            (position) => position.locationId === 'C3'
        )
        game.act('MoveRebellionStation', { stationId: 'CNoR:home', position: destination })
        game.act('DeclinePrivateTile', { privateCompanyId: 'NWR' })
        expect(game.state.privateTrackLay).toBeUndefined()
        expect(privatePowerUsed(game.state, 'NWR')).toBe(true)
        expect(game.valid()).not.toContain('MoveRebellionStation')
        expect(game.valid()).toContain('LayTile')
    })

    it('is used in the track, station, run and train steps, not while sharing out earnings (ruling 6)', () => {
        const game = northernWithRebellion()
        const mover = (machineState: State1882['machineState']) => {
            const state = structuredClone(game.state)
            state.machineState = machineState
            return rebellionMover(state, game.player)
        }
        for (const step of [
            'LayingTrack',
            'PlacingStation',
            'RunningTrains',
            'BuyingTrains'
        ] as const)
            expect(mover(step)).toBe('CNoR')
        expect(mover('DistributingEarnings')).toBeUndefined()
    })

    it('moves none of the Canadian National’s neutral stations (ruling 7)', () => {
        const game = northernWithRebellion()
        edit(game, (state) => {
            state.stations = state.stations.map((station) =>
                station.id === neutralStationId('GTP')
                    ? {
                          ...station,
                          status: 'placed',
                          position: { locationId: 'J10', nodeId: 'city-1', slot: 0 }
                      }
                    : station
            )
        })
        expect(movableStations(game.state, 'CN')).toEqual([])
    })
})
