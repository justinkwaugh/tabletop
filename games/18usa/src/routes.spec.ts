import { describe, expect, it } from 'vitest'
import {
    RouteEvaluation,
    payingRouteStops,
    routeConnectionBonuses,
    type RevenueCenter
} from '@tabletop/18xx'
import { edit } from '../test/kit.js'
import { givePrivate, operatingCompany, setPhase } from '../test/positions.js'
import {
    CoalMarker,
    EighteenUSARouteRules,
    EighteenUSAStationRules,
    EighteenUSATileSet,
    EighteenUSATrackRules,
    EighteenUSATrainDepot,
    ExpressFreightMarker,
    MexicoLocationIds,
    OilMarker,
    RichOreMarker,
    RuralJunctionTileIds,
    SwitcherSuffix
} from './index.js'

const KansasCity = 'E15'
const train = (id: string) => EighteenUSATrainDepot.trainDefinition(id)
const stop = (locationId: string, nodeId = 'city'): RevenueCenter => ({ locationId, nodeId })

describe('resources (§13)', () => {
    it('pays every route passing a token’s hex: coal $10, rich ore $20, oil $20 from phase 5', () => {
        const game = operatingCompany(KansasCity, (state) => {
            state.locationMarkers = [
                { locationId: 'C9', kind: CoalMarker, privateCompanyId: 'P1' },
                { locationId: 'H6', kind: RichOreMarker, privateCompanyId: 'P4' },
                { locationId: 'G15', kind: OilMarker, privateCompanyId: 'P3' }
            ]
        })
        const bonus = (locationId: string) =>
            EighteenUSARouteRules.hexBonus?.(game.hydrated, locationId, 'ATSF')
        expect([bonus('C9'), bonus('H6'), bonus('G15')]).toEqual([10, 20, 10])
        edit(game, (state) => setPhase(state, '5'))
        expect(bonus('G15')).toBe(20)
    })

    it('lets a train pass a resource tile only once, however many exits it has', () => {
        const game = operatingCompany(KansasCity, (state) => {
            state.locationMarkers = [
                { locationId: 'C9', kind: CoalMarker, privateCompanyId: 'P1' },
                { locationId: 'B2', kind: ExpressFreightMarker, privateCompanyId: 'P8' }
            ]
        })
        const once = (locationId: string) =>
            EighteenUSARouteRules.forbidsHexReentry?.(game.hydrated, locationId)
        expect([once('C9'), once('B2'), once('G15')]).toEqual([true, false, false])
    })
})

describe('Company Town (P27)', () => {
    it('never blocks another company’s routes, track or station placements', () => {
        const game = operatingCompany(KansasCity, (state) => {
            const [piece] = EighteenUSATileSet.availablePieces(state.tileInventory, '18usa:X20')
            state.tileInventory = EighteenUSATileSet.replace(state.tileInventory, {
                locationId: 'G15',
                placement: { pieceId: piece.id, definitionId: '18usa:X20', rotation: 0 },
                returnPrevious: true
            })
        })
        const town = stop('G15')
        expect(EighteenUSARouteRules.passesStations?.(game.hydrated, 'BO', town)).toBe(true)
        expect(EighteenUSATrackRules.passesStations?.(game.hydrated, 'BO', town)).toBe(true)
        expect(EighteenUSAStationRules.passesStations?.(game.hydrated, 'BO', town)).toBe(true)
        expect(EighteenUSATrackRules.passesStations?.(game.hydrated, 'BO', stop(KansasCity))).toBe(
            false
        )
    })
})

describe('Pullmans (§12.7)', () => {
    it('add $20 at each stop of the train that draws one', () => {
        const game = operatingCompany(KansasCity)
        const drawn = EighteenUSARouteRules.attachedDefinition?.(game.hydrated, train('5'), [
            train('P')
        ])
        expect(typeof drawn).toBe('object')
        if (typeof drawn !== 'object') return
        expect(EighteenUSARouteRules.stopBonus?.(game.hydrated, drawn, 'ATSF', stop('E15'))).toBe(
            20
        )
        expect(
            EighteenUSARouteRules.stopBonus?.(game.hydrated, train('5'), 'ATSF', stop('E15'))
        ).toBe(0)
    })

    it('ride on one train, never alone or two to a train', () => {
        const game = operatingCompany(KansasCity)
        expect(
            typeof EighteenUSARouteRules.attachedDefinition?.(game.hydrated, train('5'), [
                train('P'),
                train('P')
            ])
        ).toBe('string')
    })
})

describe('Mexico (§12.4.1)', () => {
    it('allows no more than two of a company’s routes to Mexico in a run', () => {
        const game = operatingCompany(KansasCity)
        const evaluation = new RouteEvaluation(game.hydrated, EighteenUSARouteRules)
        const toMexico = (locationId: string) => ({
            visits: [stop('E15'), stop(locationId, 'offboard')]
        })
        const [first, second, third] = MexicoLocationIds
        expect(evaluation.overStopGroupLimit([toMexico(first), toMexico(second)])).toBeUndefined()
        expect(
            evaluation.overStopGroupLimit([toMexico(first), toMexico(second), toMexico(third)])
        ).toBe('mexico')
    })
})

describe('Great Northern (P17)', () => {
    it('pays $30 for Fargo and Helena, $30 more when the same train also runs Seattle and Chicago', () => {
        const game = operatingCompany(KansasCity, (state) => givePrivate(state, 'P17', 'ATSF'))
        const policy =
            EighteenUSARouteRules.revenuePolicy?.(train('8'), game.hydrated, 'ATSF') ?? {}
        const paid = (locationIds: string[]) =>
            routeConnectionBonuses(
                locationIds.map((locationId) => ({
                    ...stop(locationId),
                    amount: 20,
                    bonus: 0,
                    companyStation: false
                })),
                policy
            ).reduce((sum, bonus) => sum + bonus.amount, 0)
        expect(paid(['B14', 'B8'])).toBe(30)
        expect(paid(['B2', 'B8', 'B14', 'D20'])).toBe(60)
        expect(paid(['B2', 'D20'])).toBe(0)
    })
})

describe('Express Freight (P8)', () => {
    it('pays its company $10 more for each train that runs to its red area', () => {
        const game = operatingCompany(KansasCity, (state) => {
            givePrivate(state, 'P8', 'ATSF')
            state.locationMarkers = [
                {
                    locationId: MexicoLocationIds[0],
                    kind: ExpressFreightMarker,
                    privateCompanyId: 'P8'
                }
            ]
        })
        const bonus = (companyId: string) =>
            EighteenUSARouteRules.stopBonus?.(
                game.hydrated,
                train('5'),
                companyId,
                stop(MexicoLocationIds[3], 'offboard')
            )
        expect(bonus('ATSF')).toBe(10)
        expect(bonus('BO')).toBe(0)
    })
})

describe('Switching (P19)', () => {
    it('never treats the train’s only station city as the plain track it passes', () => {
        const game = operatingCompany(KansasCity)
        const switched = { ...train('3'), id: `3${SwitcherSuffix}` }
        const policy = EighteenUSARouteRules.revenuePolicy?.(switched, game.hydrated, 'ATSF') ?? {}
        const visit = (locationId: string, amount: number, companyStation = false) => ({
            locationId,
            nodeId: 'city',
            amount,
            bonus: 0,
            companyStation
        })
        const paid = payingRouteStops(
            [visit(KansasCity, 20, true), visit('E17', 40), visit('D14', 30)],
            policy
        ).map((entry) => entry.locationId)
        expect(paid).toEqual([KansasCity, 'E17'])
    })
})

describe('Rural Junction (P26)', () => {
    it('lets no route begin or end at a rural junction', () => {
        const [junction] = RuralJunctionTileIds
        const game = operatingCompany(KansasCity, (state) => {
            const [piece] = EighteenUSATileSet.availablePieces(state.tileInventory, junction)
            state.tileInventory = EighteenUSATileSet.replace(state.tileInventory, {
                locationId: 'G15',
                placement: { pieceId: piece.id, definitionId: junction, rotation: 0 },
                returnPrevious: true
            })
        })
        const ends = (locationId: string) =>
            EighteenUSARouteRules.endsRoutes?.(game.hydrated, 'ATSF', stop(locationId))
        expect([ends('G15'), ends(KansasCity)]).toEqual([false, true])
    })
})
