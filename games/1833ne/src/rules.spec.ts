import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    TileUpgrades,
    TrackConstruction,
    rotateTileFace,
    type TileFace,
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
import { TileSet1833NE } from './tiles.js'
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

    it('removes players’ privates and P1–P2 at III and flips the rest, P3–P5 go at IV, the D&H never', () => {
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
        const effects = (phaseId: string, kind: 'close' | 'income') =>
            privatePhaseEffects({ ...state, phaseId })
                .filter((effect) => effect.kind === kind)
                .map((effect) => effect.privateCompanyId)
        expect(effects('II', 'close')).toEqual([])
        expect(effects('II', 'income')).toEqual([])
        expect(effects('III', 'close')).toEqual(['P1', 'P2', 'P5'])
        // P3, P4 and the D&H flip over: no more income, abilities kept.
        expect(effects('III', 'income')).toEqual(['P3', 'P4', 'P6'])
        expect(effects('IV', 'close')).toEqual(['P1', 'P2', 'P3', 'P4', 'P5'])
        for (const id of ['P3', 'P4', 'P6'])
            state.companies.find((company) => company.id === id)!.privateRevenue = 0
        expect(effects('IV', 'income')).toEqual([])
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

/** The lays a company with $500 may make at a location in its track step. */
function trackChoices(state: ReturnType<typeof position>, companyId: string, locationId: string) {
    state.trackStep = { companyId, lays: [], completed: false }
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    assertExists(account, `${companyId} has a cash account`)
    account.amount = 500
    const hydrated = table(4).engine.runtime.hydrator.hydrateState(state)
    return new TrackConstruction(hydrated, TrackRules1833NE).choices(locationId)
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
    const brownChoices = (
        locationId: string,
        definitionId: string,
        edges: number[],
        retiredPieceIds: string[] = []
    ) => {
        const state = position(
            [{ locationId, definitionId, rotation: rotationFor(definitionId, edges) }],
            [{ companyId: 'CV', locationId }],
            {},
            'IV'
        )
        state.tileInventory.retiredPieceIds.push(...retiredPieceIds)
        return [
            ...new Set(
                trackChoices(state, 'CV', locationId).map((choice) =>
                    choice.definitionId.replace('1833ne:', '')
                )
            )
        ].sort()
    }

    it('offers only 60 and 70 cities where they fit', () => {
        expect(brownChoices('F19', '18xx:619', [0, 2, 3, 4])).toEqual(['N50', 'N54'])
    })

    it('upgrades each green city to its own 50 as the manifest lists (p. 21)', () => {
        const definition = (id: string) =>
            TileSet1833NE.definitions.find((entry) => entry.id === id)!
        const exits = (face: TileFace) =>
            face.paths.flatMap((path) =>
                path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            )
        const upgrades = (green: string) =>
            TileSet1833NE.definitions
                .filter(
                    (brown) =>
                        brown.face.color === 'brown' &&
                        brown.face.labels.length === 0 &&
                        brown.face.nodes.some((node) => node.kind === 'city')
                )
                .filter((brown) =>
                    ([0, 1, 2, 3, 4, 5] as const).some((rotation) => {
                        const after = exits(rotateTileFace(brown.face, rotation))
                        return exits(definition(green).face).every((edge) => after.includes(edge))
                    })
                )
                .map((brown) => brown.id.replace('1833ne:', ''))
                .sort()
        expect(upgrades('18xx:14')).toEqual(['N50', 'N51', 'N54'])
        expect(upgrades('18xx:15')).toEqual(['N50', 'N52', 'N54'])
        expect(upgrades('18xx:619')).toEqual(['N50', 'N53', 'N54'])
        expect(upgrades('1833ne:N27')).toEqual(['N50', 'N52', 'N54'])
        expect(upgrades('1833ne:N28')).toEqual(['N50', 'N51', 'N54'])
    })

    it('lists Manchester’s green tiles’ brown upgrades, which drop its label', () => {
        const upgrades = new TileUpgrades(TrackRules1833NE)
        const brown = (id: string) =>
            upgrades
                .upgradesTo(id)
                .map((entry) => entry.replace('1833ne:', ''))
                .sort()
        expect(brown('1833ne:N27')).toEqual(['N50', 'N52', 'N54'])
        expect(brown('1833ne:N28')).toEqual(['N50', 'N51', 'N54'])
    })

    it('offers the 50 once no 60 or 70 is left', () => {
        const pieces = (id: string, count: number) =>
            Array.from({ length: count }, (_, index) => `1833ne/${id}/${index + 1}`)
        expect(
            brownChoices(
                'F19',
                '18xx:619',
                [0, 2, 3, 4],
                [...pieces('N50', 5), ...pieces('N54', 2)]
            )
        ).toEqual(['N53'])
    })

    it('offers a 50 where no 60 or 70 fits, as in Portsmouth', () => {
        const choices = brownChoices('H17', '18xx:15', [0, 1, 2, 3])
        expect(choices.length).toBeGreaterThan(0)
        expect(choices.every((id) => ['N51', 'N52', 'N53'].includes(id))).toBe(true)
    })
})

describe('Boston (§6.48, §6.62)', () => {
    it('lets a corporation reaching only Boston’s terminal upgrade the city', () => {
        // The B&P runs from Providence through Mansfield into Boston's terminal triangle.
        const state = position(
            [{ locationId: 'G24', definitionId: '18xx:58', rotation: 1 }],
            [{ companyId: 'B&P', locationId: 'F25' }],
            {},
            'II'
        )
        const choices = trackChoices(state, 'B&P', 'G22')
        expect(choices.map(({ definitionId, rotation }) => ({ definitionId, rotation }))).toEqual([
            { definitionId: '1833ne:N23', rotation: 4 }
        ])
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

    it('charges only $20 to upgrade a hex whose terrain is paid, discount or not', () => {
        const state = position(
            [
                { locationId: 'C18', definitionId: '18xx:9', rotation: 0 },
                { locationId: 'B21', definitionId: '18xx:9', rotation: 0 }
            ],
            [],
            {},
            'III'
        )
        const cost = (companyId: string, locationId: string) =>
            TrackRules1833NE.terrainCost?.(
                state,
                { companyId, locationId, definitionId: '18xx:23', rotation: 0, nodeMapping: {} },
                0
            )
        expect([cost('B&W', 'C18'), cost('B&W', 'B21')]).toEqual([20, 20])
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

describe('tile supply and orientation (§6.46–6.47)', () => {
    it('never runs out of the basic yellow track tiles #7, #8 and #9', () => {
        const inventory = TileSet1833NE.createInventory([])
        const retired = Array.from({ length: 12 }, (_, index) => `1833ne/7/${index + 1}`)
        for (const id of ['18xx:7', '18xx:8', '18xx:9'])
            expect(
                TileSet1833NE.availablePieces({ ...inventory, retiredPieceIds: retired }, id).length
            ).toBeGreaterThan(0)
    })

    it('lays Sherbrooke’s tile only as its arrow shows: north, north-east and south', () => {
        const state = position([], [], {})
        const request = (rotation: 0 | 1) => ({
            companyId: 'StL&A',
            locationId: 'F5',
            definitionId: '1833ne:N11',
            rotation,
            nodeMapping: {}
        })
        expect(TrackRules1833NE.restriction?.(state, request(0))).toBeUndefined()
        expect(TrackRules1833NE.restriction?.(state, request(1))).toContain('arrow')
    })
})
