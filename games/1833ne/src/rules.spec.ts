import { describe, expect, it } from 'vitest'
import {
    TrackConstruction,
    privateTrackConstruction,
    usesStationAt,
    type TrackLayDetails
} from '@tabletop/18xx'
import { table } from '../test/table.js'
import { position } from '../test/position.js'
import { buyAllPrivates, launch, passStockRound, rotationFor } from '../test/flow.js'
import { PrivatePowerRules1833NE, blockedByPrivate, privatePhaseEffects } from './privates.js'
import { trainRetirement } from './trains.js'
import { Map1833NE } from './map.js'
import { TrackRules1833NE } from './track.js'

describe('phases (§9)', () => {
    it('phases out trains two phases on and removes them three phases on', () => {
        expect(trainRetirement('II', '2')).toBeUndefined()
        expect(trainRetirement('III', '2+1')).toBe('after-operation')
        expect(trainRetirement('IV', '2')).toBe('immediate')
        expect(trainRetirement('IV', '3/5')).toBe('after-operation')
        expect(trainRetirement('V', '2+2')).toBe('immediate')
        expect(trainRetirement('V', '4/7')).toBe('after-operation')
        expect(trainRetirement('V', '7+3')).toBeUndefined()
    })

    it('removes players’ privates and P1–P2 at III, P3–P5 at IV, never the D&H', () => {
        const state = structuredClone(table(4).state)
        const own = (privateId: string, companyId?: string) => {
            const certificate = state.certificates.find(
                (entry) => entry.companyId === privateId && entry.kind === 'private'
            )!
            certificate.owner = companyId
                ? { kind: 'company', companyId }
                : { kind: 'player', playerId: 'p1' }
        }
        for (const id of ['P1', 'P2', 'P3', 'P4', 'P6']) own(id, 'B&W')
        own('P5')
        const closing = (phaseId: string) =>
            privatePhaseEffects({ ...state, phaseId }).map((effect) => effect.privateCompanyId)
        expect(closing('II')).toEqual([])
        expect(closing('III')).toEqual(['P1', 'P2', 'P5'])
        expect(closing('IV')).toEqual(['P1', 'P2', 'P3', 'P4', 'P5'])
    })
})

function layDetails(locationId: string, definitionId: string, companyId: string): TrackLayDetails {
    return {
        companyId,
        locationId,
        definitionId,
        rotation: 0,
        nodeMapping: {},
        placement: { pieceId: 'x', definitionId, rotation: 0 },
        cost: 20,
        terrainCost: 20,
        allowanceCost: 0,
        movedStations: []
    }
}

describe('the St. Lawrence corporations', () => {
    it('share a token placed in Sherbrooke with its yellow tile (§6.53)', () => {
        const state = position(
            [{ locationId: 'F5', definitionId: '1833ne:N11', rotation: 0 }],
            [],
            {}
        )
        const hydrated = table(4).engine.runtime.hydrator.hydrateState(state)
        TrackRules1833NE.afterLay?.(hydrated, layDetails('F5', '1833ne:N11', 'CV'), {
            kind: 'company',
            companyId: 'CV'
        })
        expect(usesStationAt(hydrated, 'StL&A', 'F5', 'city')).toBe(true)
        expect(usesStationAt(hydrated, 'A&StL', 'F5', 'city')).toBe(true)
        expect(
            hydrated.stations.filter(
                (station) => station.status === 'placed' && station.position.locationId === 'F5'
            )
        ).toHaveLength(1)
    })
})

describe('brown cities (p. 21)', () => {
    const brownChoices = (locationId: string, definitionId: string, edges: number[]) => {
        const state = position(
            [{ locationId, definitionId, rotation: rotationFor(definitionId, edges) }],
            [{ companyId: 'CV', locationId }],
            {},
            'IV'
        )
        state.trackStep = { companyId: 'CV', lays: [], completed: false }
        const account = state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'CV'
        )!
        account.amount = 500
        const hydrated = table(4).engine.runtime.hydrator.hydrateState(state)
        return [
            ...new Set(
                new TrackConstruction(hydrated, TrackRules1833NE)
                    .choices(locationId)
                    .map((choice) => choice.definitionId.replace('1833ne:', ''))
            )
        ].sort()
    }

    it('offers only 60 and 70 cities where they fit', () => {
        expect(brownChoices('F19', '18xx:619', [0, 2, 3, 4])).toEqual(['N50', 'N54'])
    })

    it('offers a 50 where no 60 or 70 fits, as in Portsmouth', () => {
        const choices = brownChoices('H17', '18xx:15', [0, 1, 2, 3])
        expect(choices.length).toBeGreaterThan(0)
        expect(choices.every((id) => ['N51', 'N52', 'N53'].includes(id))).toBe(true)
    })
})

describe('the golden spike (corporate mats)', () => {
    it('pays $100 to the president of each St. Lawrence corporation that laid yellow track', () => {
        const straight = (locationId: string, edges: number[], definitionId = '18xx:9') => ({
            locationId,
            definitionId,
            rotation: rotationFor(definitionId, edges)
        })
        const state = position(
            [
                straight('C4', [2, 5], '18xx:4'),
                straight('D5', [2, 5]),
                straight('E6', [2, 5]),
                straight('F7', [2, 5]),
                straight('G8', [2, 5]),
                straight('H9', [0, 2], '18xx:8'),
                straight('H11', [0, 3]),
                straight('H13', [3, 5], '18xx:8')
            ],
            [],
            {}
        )
        for (const company of state.companies)
            if (company.id === 'StL&A' || company.id === 'A&StL') {
                company.started = true
                company.president = {
                    kind: 'player',
                    playerId: company.id === 'StL&A' ? 'p1' : 'p2'
                }
            }
        state.spikeLayers = ['StL&A']
        const hydrated = table(4).engine.runtime.hydrator.hydrateState(state)
        const owner = { kind: 'company' as const, companyId: 'StL&A' }
        const effects = TrackRules1833NE.afterLay?.(
            hydrated,
            layDetails('H13', '18xx:8', 'StL&A'),
            owner
        )
        expect(effects?.payments).toEqual([
            { from: { kind: 'bank' }, to: { kind: 'player', playerId: 'p1' }, amount: 100 }
        ])
        expect(hydrated.goldenSpike).toBe(true)
        expect(
            TrackRules1833NE.afterLay?.(hydrated, layDetails('H13', '18xx:8', 'StL&A'), owner)
                ?.payments
        ).toEqual([])
    })
})

describe('Lowell Merchants (P2)', () => {
    it('makes its buyer’s G20 tile free in the round it bought it', () => {
        const state = position([], [], {})
        state.operatingSet = {
            number: 2,
            roundNumber: 1,
            roundCount: 2,
            companyOrder: ['B&L'],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        state.lowellPurchase = { companyId: 'B&L', operatingSet: 2, round: 1 }
        const request = {
            companyId: 'B&L',
            locationId: 'G20',
            definitionId: '18xx:5',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRules1833NE.terrainCost?.(state, request, 0)).toBe(0)
        expect(TrackRules1833NE.terrainCost?.(state, { ...request, companyId: 'B&P' }, 0)).toBe(20)
    })
})

describe('Champlain & St. Lawrence (P3)', () => {
    it('once used lays both its tiles, C4 to Montreal and C6 to C4, without a decline', () => {
        const game = table()
        buyAllPrivates(game)
        launch(game, 'StL&A', 100)
        passStockRound(game)
        const certificate = game.state.certificates.find(
            (entry) => entry.companyId === 'P3' && entry.kind === 'private'
        )!
        certificate.owner = { kind: 'company', companyId: 'StL&A' }
        const president = game.player
        const layChamplain = (locationId: string) => {
            const terms = PrivatePowerRules1833NE.trackTerms(game.hydrated, 'P3', president)!
            const [choice] = privateTrackConstruction(
                game.hydrated,
                terms,
                TrackRules1833NE
            ).choices(locationId)
            game.act('LayPrivateTile', {
                privateCompanyId: 'P3',
                companyId: 'StL&A',
                locationId,
                definitionId: choice.definitionId,
                rotation: choice.rotation,
                nodeMapping: choice.nodeMapping,
                expectedCost: choice.cost
            })
        }
        expect(game.valid(president)).toContain('LayPrivateTile')
        const cash = game.state.companies.find((company) => company.id === 'StL&A')
        layChamplain('C4')
        expect(game.state.privateTrackLay).toEqual({
            privateCompanyId: 'P3',
            playerId: president,
            required: true
        })
        // A standing run instruction is no move, so it stays open.
        expect(game.valid(president).filter((type) => type !== 'SetRunInstruction')).toEqual([
            'LayPrivateTile'
        ])
        expect(() => game.act('DeclinePrivateTile', { privateCompanyId: 'P3' })).toThrow()
        expect(
            PrivatePowerRules1833NE.trackTerms(game.hydrated, 'P3', president)?.locationIds
        ).toEqual(['C6'])
        layChamplain('C6')
        expect(game.state.privateTrackLay).toBeUndefined()
        expect(game.valid(president)).not.toContain('LayPrivateTile')
        expect(
            game.state.tileInventory.placements.C4 && game.state.tileInventory.placements.C6
        ).toBeTruthy()
        expect(game.state.companies.find((company) => company.id === 'StL&A')).toEqual(cash)
    })
})

describe('terrain discounts (§6.49)', () => {
    it('charges the printed lower cost to its corporation, or from its phase', () => {
        const state = position([], [], {})
        const cost = (companyId: string, locationId: string, phaseId = 'I') =>
            TrackRules1833NE.terrainCost?.(
                { ...state, phaseId },
                { companyId, locationId, definitionId: '18xx:7', rotation: 0, nodeMapping: {} },
                Map1833NE.location(locationId).terrain?.cost ?? 0
            )
        expect([cost('B&W', 'B21'), cost('B&W', 'C20'), cost('B&P', 'B21')]).toEqual([20, 20, 60])
        expect([cost('HR', 'D23'), cost('B&W', 'D23')]).toEqual([20, 60])
        expect([cost('B&W', 'C18', 'II'), cost('B&W', 'C18', 'III')]).toEqual([100, 40])
        expect([cost('B&W', 'D27', 'III'), cost('B&W', 'D27', 'IV')]).toEqual([100, 60])
    })
})

describe('private blocks (§6.46)', () => {
    it('keeps track out of G20 until a corporation buys Lowell Merchants or it closes', () => {
        const state = structuredClone(table(4).state)
        const certificate = state.certificates.find(
            (entry) => entry.companyId === 'P2' && entry.kind === 'private'
        )!
        certificate.owner = { kind: 'player', playerId: 'p1' }
        expect(blockedByPrivate(state, 'G20')).toBe(true)
        certificate.owner = { kind: 'company', companyId: 'B&L' }
        expect(blockedByPrivate(state, 'G20')).toBe(false)
        certificate.owner = { kind: 'player', playerId: 'p1' }
        state.companies.find((company) => company.id === 'P2')!.closed = true
        expect(blockedByPrivate(state, 'G20')).toBe(false)
    })
})
