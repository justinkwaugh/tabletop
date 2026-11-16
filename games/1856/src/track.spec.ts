import { describe, expect, it } from 'vitest'
import {
    TileUpgrades,
    TrackConstruction,
    type ConstructionState,
    type TileRotation
} from '@tabletop/18xx'
import { minimalRailwayState } from '@tabletop/18xx/testing'
import { BbgId, CprId, CvId, FlosId, GtId, GwId, TgbId, ThbId, WrId } from './companies.js'
import { HamiltonLocationId, Map1856, TorontoLocationId } from './map.js'
import { TileSet1856 } from './tiles.js'
import { TrackRules1856 } from './track.js'

const Upgrades = new TileUpgrades(TrackRules1856)

const numbers = (definitionIds: Iterable<string>) =>
    [...definitionIds].map((id) => id.replace(/^(18xx|1856):/, '')).sort()
function upgradesOf(number: string): string[] {
    const definition = TileSet1856.definitions.find((tile) => tile.printedNumber === number)
    if (!definition) throw new Error(`No tile ${number}`)
    return numbers(Upgrades.upgradesTo(definition.id))
}

type Placement = { locationId: string; definitionId: string; rotation: TileRotation }
type Station = { locationId: string; nodeId: string }

/** A company's track step in the phase, with its stations placed and the tiles already laid. */
function laying(
    companyId: string,
    phaseId: string,
    {
        stations = [],
        placements = []
    }: { stations?: readonly Station[]; placements?: readonly Placement[] } = {}
): ConstructionState {
    const state = minimalRailwayState()
    const inventory = TileSet1856.createInventory()
    for (const { locationId, definitionId, rotation } of placements) {
        const [piece] = TileSet1856.availablePieces(inventory, definitionId)
        if (!piece) throw new Error(`No ${definitionId} left`)
        inventory.placements[locationId] = { pieceId: piece.id, definitionId, rotation }
    }
    return {
        ...state,
        companies: [{ id: companyId, kind: 'major' }],
        cash: [
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            { owner: { kind: 'company', companyId }, amount: 1000 }
        ],
        stations: stations.map((position, index) => ({
            id: `${companyId}-${index}`,
            companyId,
            status: 'placed',
            position: { ...position, slot: 0 }
        })),
        stationReservations: Map1856.stationReservations(),
        tileInventory: inventory,
        phaseId,
        trackStep: { companyId, lays: [], completed: false }
    }
}

const choices = (state: ConstructionState, locationId: string) =>
    new TrackConstruction(state, TrackRules1856).choices(locationId)
const choiceNumbers = (state: ConstructionState, locationId: string) => [
    ...new Set(numbers(choices(state, locationId).map((choice) => choice.definitionId)))
]

describe('1856 upgrades (Tiles and Upgrades)', () => {
    it('upgrades yellow to green as the upgrade list prints', () => {
        expect(upgradesOf('5')).toEqual(['14', '15'])
        expect(upgradesOf('6')).toEqual(['14', '15'])
        expect(upgradesOf('57')).toEqual(['14', '15'])
        expect(upgradesOf('7')).toEqual(['18', '26', '27', '28', '29'])
        expect(upgradesOf('8')).toEqual(['16', '17', '19', '23', '24', '25', '28', '29'])
        expect(upgradesOf('9')).toEqual(['18', '19', '20', '23', '24', '26', '27'])
        expect(upgradesOf('69')).toEqual([])
    })

    it('upgrades green to brown as the upgrade list prints', () => {
        expect(upgradesOf('14')).toEqual(['125', '63'])
        expect(upgradesOf('15')).toEqual(['125', '63'])
        expect(upgradesOf('16')).toEqual(['43', '70'])
        expect(upgradesOf('17')).toEqual(['47'])
        expect(upgradesOf('18')).toEqual(['43'])
        expect(upgradesOf('19')).toEqual(['45', '46'])
        expect(upgradesOf('20')).toEqual(['44', '47'])
        expect(upgradesOf('23')).toEqual(['41', '43', '45', '47'])
        expect(upgradesOf('24')).toEqual(['42', '43', '46', '47'])
        expect(upgradesOf('25')).toEqual(['40', '45', '46'])
        expect(upgradesOf('26')).toEqual(['42', '44', '45'])
        expect(upgradesOf('27')).toEqual(['41', '44', '46'])
        expect(upgradesOf('28')).toEqual(['39', '43', '46', '70'])
        expect(upgradesOf('29')).toEqual(['39', '43', '45', '70'])
        expect(upgradesOf('59')).toEqual(['64', '65', '66', '67', '68'])
        expect(upgradesOf('120')).toEqual(['122'])
        expect(upgradesOf('121')).toEqual(['126', '127'])
    })

    it('upgrades brown to gray only in Hamilton and Toronto', () => {
        for (const number of ['64', '65', '66', '67', '68'])
            expect(upgradesOf(number)).toEqual(['123'])
        expect(upgradesOf('122')).toEqual(['124'])
        for (const number of ['39', '43', '63', '125', '126', '127'])
            expect(upgradesOf(number)).toEqual([])
    })

    it('turns small cities into large cities or plain track, and double small cities into green cities', () => {
        expect(upgradesOf('3')).toEqual(['5', '7'])
        expect(upgradesOf('4')).toEqual(['57', '9'])
        expect(upgradesOf('58')).toEqual(['6', '8'])
        expect(upgradesOf('1')).toEqual(['14'])
        expect(upgradesOf('55')).toEqual(['14'])
        expect(upgradesOf('2')).toEqual(['15'])
        expect(upgradesOf('56')).toEqual(['15'])
    })
})

describe('1856 track', () => {
    it('upgrades London and Barrie through #121 to their own brown tiles', () => {
        expect(choiceNumbers(laying(CprId, '3'), 'M4')).toEqual(['121'])
        const green = (companyId: string, locationId: string) =>
            laying(companyId, '5', {
                placements: [{ locationId, definitionId: '1856:121', rotation: 0 }]
            })
        expect(choiceNumbers(green(CprId, 'M4'), 'M4')).toEqual(['127'])
        expect(choiceNumbers(green(GwId, 'F15'), 'F15')).toEqual(['126'])
    })

    it('upgrades Toronto through #120 and #122 to #124, keeping South Toronto’s city', () => {
        const yellow = choices(laying(CvId, '3'), TorontoLocationId)
        expect(numbers(yellow.map((choice) => choice.definitionId))).toEqual(['120'])
        expect(yellow.every((choice) => choice.cost === 0)).toBe(true)
        const south = { locationId: TorontoLocationId, nodeId: 'city-0' }
        const brown = laying(CvId, '5', {
            stations: [south],
            placements: [{ locationId: TorontoLocationId, definitionId: '1856:120', rotation: 1 }]
        })
        expect(choiceNumbers(brown, TorontoLocationId)).toEqual(['122'])
        const gray = laying(CvId, '6', {
            stations: [south],
            placements: [{ locationId: TorontoLocationId, definitionId: '1856:122', rotation: 1 }]
        })
        expect(choiceNumbers(gray, TorontoLocationId)).toEqual(['124'])
        expect(choiceNumbers({ ...gray, phaseId: '5' }, TorontoLocationId)).toEqual([])
    })

    it('charges Hamilton’s $40 for its first tile only, and takes Hamilton alone to gray', () => {
        const first = choices(laying(ThbId, '3'), HamiltonLocationId)
        expect(numbers(first.map((choice) => choice.definitionId))).toContain('59')
        expect(
            first.every((choice) => choice.definitionId === '18xx:59' && choice.cost === 40)
        ).toBe(true)
        const upgraded = laying(ThbId, '5', {
            stations: [{ locationId: HamiltonLocationId, nodeId: 'city-0' }],
            placements: [{ locationId: HamiltonLocationId, definitionId: '18xx:59', rotation: 0 }]
        })
        const brown = choices(upgraded, HamiltonLocationId)
        expect(brown.length).toBeGreaterThan(0)
        expect(brown.every((choice) => choice.cost === 0)).toBe(true)
        const grayHamilton = laying(ThbId, '6', {
            stations: [{ locationId: HamiltonLocationId, nodeId: 'city-0' }],
            placements: [{ locationId: HamiltonLocationId, definitionId: '18xx:64', rotation: 3 }]
        })
        expect(choiceNumbers(grayHamilton, HamiltonLocationId)).toEqual(['123'])
        const grayWelland = laying(WrId, '6', {
            stations: [{ locationId: 'N17', nodeId: 'city-0' }],
            placements: [{ locationId: 'N17', definitionId: '18xx:64', rotation: 0 }]
        })
        expect(choiceNumbers(grayWelland, 'N17')).toEqual([])
    })

    it('takes brown #125 on an L hex and #63 elsewhere', () => {
        const oshawa = laying(GtId, '5', {
            placements: [{ locationId: 'P9', definitionId: '18xx:14', rotation: 1 }]
        })
        expect(choiceNumbers(oshawa, 'P9')).toEqual(['125'])
        const brantford = laying(BbgId, '5', {
            placements: [{ locationId: 'J15', definitionId: '18xx:14', rotation: 0 }]
        })
        expect(choiceNumbers(brantford, 'J15')).toEqual(['63'])
    })

    // Orangeville's (K8) track to the lower left meets J9's small city at its upper right.
    const orangeville = (phaseId: string, definitionId: string): ConstructionState =>
        laying(TgbId, phaseId, {
            stations: [{ locationId: 'K8', nodeId: 'city' }],
            placements: [
                { locationId: 'K8', definitionId: '18xx:57', rotation: 1 },
                { locationId: 'J9', definitionId, rotation: 1 }
            ]
        })

    it('upgrades or downgrades a connected small city from the first 6-train (Phase Five)', () => {
        expect(choiceNumbers(orangeville('5', '18xx:4'), 'J9')).toEqual([])
        expect(choiceNumbers(orangeville('6', '18xx:4'), 'J9')).toEqual(['57', '9'])
        expect(choiceNumbers(orangeville('D', '18xx:4'), 'J9')).toEqual(['57', '9'])
    })

    // Brantford's (J15) track to the upper left meets Drumbo's two small cities (I14).
    const brantfordDrumbo = (phaseId: string): ConstructionState =>
        laying(BbgId, phaseId, {
            stations: [{ locationId: 'J15', nodeId: 'city' }],
            placements: [
                { locationId: 'J15', definitionId: '18xx:57', rotation: 2 },
                { locationId: 'I14', definitionId: '18xx:1', rotation: 1 }
            ]
        })

    it('upgrades double small cities to a green city from the first 6-train, keeping their exits', () => {
        expect(choiceNumbers(brantfordDrumbo('5'), 'I14')).toEqual([])
        const upgrades = choices(brantfordDrumbo('6'), 'I14')
        expect(choiceNumbers(brantfordDrumbo('6'), 'I14')).toEqual(['14'])
        expect(upgrades.map((choice) => choice.rotation).sort()).toEqual([1, 4])
    })

    it('lays one tile a turn', () => {
        const state = laying(BbgId, '3')
        expect(TrackRules1856.allowance(state, 'yellow')).toEqual({ cost: 0 })
        const laid: ConstructionState = {
            ...state,
            trackStep: {
                companyId: BbgId,
                lays: [{ locationId: 'J15', definitionId: '18xx:57' }],
                completed: false
            }
        }
        expect(TrackRules1856.allowance(laid, 'green', true)).toHaveProperty('reason')
    })

    it('keeps a player-owned private’s hex closed to track', () => {
        const state = laying(CprId, '2')
        const owned: ConstructionState = {
            ...state,
            companies: [...state.companies, { id: FlosId, kind: 'private' }]
        }
        const request = {
            companyId: CprId,
            locationId: 'L3',
            definitionId: '18xx:7',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRules1856.restriction(owned, request)).toMatch(/private/)
        expect(TrackRules1856.restriction(state, request)).toBeUndefined()
    })

    it('starts every company at home, the THB in either city of Hamilton', () => {
        expect(TrackRules1856.homeLocations(ThbId)).toEqual([HamiltonLocationId])
        expect(TrackRules1856.homeLocations(CvId)).toEqual([TorontoLocationId])
        expect(TrackRules1856.homeLocations('CGR')).toEqual([])
    })
})
