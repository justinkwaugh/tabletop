import { describe, expect, it } from 'vitest'
import { addCompanyStations, getCompany, type TileRotation } from '@tabletop/18xx'
import { edit } from '../test/kit.js'
import { atLimitWithExpressFreight, mergerChoice } from '../test/mergers.js'
import { givePrivate, operatingCompany } from '../test/positions.js'
import {
    EighteenUSAPrivatePowerRules,
    EighteenUSAStations,
    EighteenUSATileSet,
    ExpressFreightMarker,
    MexicoLocationIds,
    StationLimit
} from './index.js'

const TileRotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]

describe('Express Freight’s marker and the station limit (P8)', () => {
    it('counts toward the eight stations, so P8 places it only below eight', () => {
        // ATSF starts in Portland with a yellow city laid toward Seattle.
        const game = operatingCompany('C3', (state) => givePrivate(state, 'P8', 'ATSF'))
        const president = game.player
        const terms = () =>
            EighteenUSAPrivatePowerRules.markerTerms?.(game.hydrated, 'P8', president)
        const rotation = TileRotations.find((rotation) => {
            edit(game, (state) => {
                const [piece] = EighteenUSATileSet.availablePieces(state.tileInventory, '18xx:57')
                state.tileInventory = EighteenUSATileSet.replace(state.tileInventory, {
                    locationId: 'C3',
                    placement: { pieceId: piece.id, definitionId: '18xx:57', rotation },
                    returnPrevious: true
                })
            })
            return terms()?.locationIds.includes('B2')
        })
        expect(rotation).toBeDefined()
        expect(terms()?.kind).toBe(ExpressFreightMarker)
        edit(game, (state) =>
            addCompanyStations(
                state,
                'ATSF',
                StationLimit - EighteenUSAStations.limitedStations(state, 'ATSF')
            )
        )
        expect(terms()).toBeUndefined()
        edit(game, (state) => {
            state.stations = state.stations.filter(
                (station) => station.companyId !== 'ATSF' || station.status !== 'available'
            )
            addCompanyStations(state, 'ATSF', StationLimit - 2)
            state.locationMarkers = [
                { locationId: 'B2', kind: ExpressFreightMarker, privateCompanyId: 'P8' }
            ]
        })
        expect(EighteenUSAStations.limitedStations(game.state, 'ATSF')).toBe(StationLimit)
    })

    it('may be given up when a merger takes its company over eight, discarding P8', () => {
        const { game, companyId, targetId } = mergerChoice()
        atLimitWithExpressFreight(game, companyId, targetId)
        game.act('MergeCompanies', { companyId, targetId })
        while (game.state.machineState !== 'ReducingStations') {
            const valid = game.valid(game.player)
            expect(valid.some((type) => type.startsWith('Pass') || type.startsWith('Finish'))).toBe(
                true
            )
            const pass = valid.find((type) => type.startsWith('Pass') || type.startsWith('Finish'))
            game.act(pass ?? '', { companyId })
        }
        expect(game.valid(game.player)).toContain('RemoveStationMarker')
        game.act('RemoveStationMarker', {
            companyId,
            locationId: MexicoLocationIds[0],
            kind: ExpressFreightMarker
        })
        expect(
            game.state.locationMarkers?.some((marker) => marker.kind === ExpressFreightMarker)
        ).toBe(false)
        expect(getCompany(game.state, 'P8').closed).toBe(true)
        expect(EighteenUSAStations.limitedStations(game.state, companyId)).toBeLessThanOrEqual(
            StationLimit
        )
    })

    it('stays when the president gives up a station instead', () => {
        const { game, companyId, targetId } = mergerChoice()
        atLimitWithExpressFreight(game, companyId, targetId)
        game.act('MergeCompanies', { companyId, targetId })
        while (game.state.machineState !== 'ReducingStations') {
            const valid = game.valid(game.player)
            const pass = valid.find((type) => type.startsWith('Pass') || type.startsWith('Finish'))
            if (!pass) throw new Error(`Stuck in ${game.state.machineState}: ${valid.join(', ')}`)
            game.act(pass, { companyId })
        }
        const [station] = EighteenUSAStations.removableStations(game.state, companyId)
        game.act('RemoveStation', { companyId, stationId: station.id })
        expect(
            game.state.locationMarkers?.some((marker) => marker.kind === ExpressFreightMarker)
        ).toBe(true)
        expect(getCompany(game.state, 'P8').closed).toBeFalsy()
    })
})
