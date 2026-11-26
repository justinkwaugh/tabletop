import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    addCompanyStations,
    getCompany,
    homeStationId,
    privateTrackConstruction,
    privateTrackTermsFor,
    locationMarkers,
    rotateTileFace,
    TileEdges,
    tileExits,
    type StationPosition
} from '@tabletop/18xx'
import { edit, type Table } from '../test/kit.js'
import {
    companyCash,
    giveTrain,
    givePrivate,
    operatingCompany,
    setPhase
} from '../test/positions.js'
import {
    AmericanLocomotiveId,
    BridgeMarker,
    ClevelandBrownTileId,
    ClevelandId,
    CompanyTownTileIds,
    EighteenUSAMap,
    EighteenUSAPrivatePowerRules,
    EighteenUSATileSet,
    EighteenUSATrackRules,
    EighteenUSATrainRules,
    FoxBridgeId,
    GreatNorthernId,
    KeystoneBridgeId,
    LehighCoalId,
    HendricksonIronId,
    CoalMarker,
    OreMarker,
    NewYorkId,
    PettiboneMullikenId,
    PlainCityTileIds,
    RegionalHeadquartersId,
    RequiredTileEdges,
    RuralJunctionId,
    SubsidyPrivateIds,
    SuemWynnId,
    noSubsidyCityIds
} from './index.js'
import { EighteenUSAPrivateRules } from './privateRules.js'
import type { EighteenUSAState } from './state.js'

const KansasCity = 'E15'
const StLouis = 'E17'

function placeTile(
    state: EighteenUSAState,
    locationId: string,
    definitionId: string,
    rotation = 0
): void {
    const [piece] = EighteenUSATileSet.availablePieces(state.tileInventory, definitionId)
    state.tileInventory = EighteenUSATileSet.replace(state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation },
        returnPrevious: true
    })
}

function moveHome(state: EighteenUSAState, companyId: string, locationId: string): void {
    state.stations = state.stations.map((station) =>
        station.companyId === companyId && station.status === 'placed'
            ? { ...station, position: { locationId, nodeId: 'city', slot: 0 } }
            : station
    )
}

function placeHome(state: EighteenUSAState, companyId: string, position: StationPosition): void {
    state.stations = [
        ...state.stations.filter((station) => station.id !== homeStationId(companyId)),
        { id: homeStationId(companyId), companyId, status: 'placed', position }
    ]
}

function lay(game: Table, locationId: string, toward?: string): void {
    const edge = TileEdges.find((side) => EighteenUSAMap.neighbor(locationId, side)?.id === toward)
    const [choice] = new TrackConstruction(game.hydrated, EighteenUSATrackRules)
        .choices(locationId)
        .filter((option) => {
            const face = EighteenUSATileSet.definitions.find(
                (tile) => tile.id === option.definitionId
            )?.face
            return (
                edge === undefined ||
                (!!face && tileExits(rotateTileFace(face, option.rotation)).has(edge))
            )
        })
    assertExists(choice, `ATSF can lay at ${locationId}`)
    game.act('LayTile', {
        companyId: 'ATSF',
        locationId,
        definitionId: choice.definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    })
}

function layPrivate(game: Table, privateId: string, locationId: string, option?: string): void {
    const offered = EighteenUSAPrivatePowerRules.trackTerms(game.hydrated, privateId, game.player)
    const terms = offered && privateTrackTermsFor(offered, option)
    assertExists(terms, `${privateId} lays track now`)
    const [choice] = privateTrackConstruction(game.hydrated, terms, EighteenUSATrackRules).choices(
        locationId
    )
    assertExists(choice, `${privateId} can lay at ${locationId}`)
    game.act('LayPrivateTile', {
        privateCompanyId: privateId,
        ...(option ? { option } : {}),
        companyId: 'ATSF',
        locationId,
        definitionId: choice.definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    })
}

const tokenPositions = (game: Table, privateId: string) =>
    EighteenUSAPrivatePowerRules.tokenTerms?.(game.hydrated, privateId, game.player)?.positions ??
    []

const companyStations = (game: Table, companyId: string) =>
    game.state.stations.filter((station) => station.companyId === companyId)

describe('the Free Station subsidy (Subsidy Tiles)', () => {
    it('places one extra station from the supply, so a company holding only its home uses it', () => {
        const game = operatingCompany(KansasCity, (state) => {
            companyCash(state, 'ATSF', 500)
            givePrivate(state, SubsidyPrivateIds.freeStation, 'ATSF')
        })
        lay(game, KansasCity, StLouis)
        lay(game, StLouis)
        expect(companyStations(game, 'ATSF')).toHaveLength(1)
        const [position] = tokenPositions(game, SubsidyPrivateIds.freeStation)
        assertExists(position, 'The Free Station goes into a reachable city')
        game.act('PlacePrivateToken', {
            privateCompanyId: SubsidyPrivateIds.freeStation,
            position
        })
        const stations = companyStations(game, 'ATSF')
        expect(stations).toHaveLength(2)
        expect(stations.every((station) => station.status === 'placed')).toBe(true)
    })
})

describe('Keystone Bridge (P21)', () => {
    it('keeps its river waiver once its bridge and resource token are both placed', () => {
        const game = operatingCompany(KansasCity, (state) => {
            companyCash(state, 'ATSF', 500)
            givePrivate(state, KeystoneBridgeId, 'ATSF')
            state.locationMarkers = [
                { locationId: KansasCity, kind: BridgeMarker, privateCompanyId: KeystoneBridgeId }
            ]
        })
        lay(game, KansasCity, 'F16')
        layPrivate(game, KeystoneBridgeId, 'F16', 'coal')
        expect(getCompany(game.state, KeystoneBridgeId).closed).toBeFalsy()
        expect(
            EighteenUSATrackRules.terrainCost?.(
                game.hydrated,
                {
                    companyId: 'ATSF',
                    locationId: StLouis,
                    definitionId: '18xx:5',
                    rotation: 0,
                    nodeMapping: {}
                },
                10
            )
        ).toBe(0)
    })
})

describe('private tile lays keep 18USA’s track rules (§12.2, P11)', () => {
    it('keeps a resource lay at D26 on the printed track toward New York', () => {
        const game = operatingCompany(KansasCity, (state) =>
            givePrivate(state, LehighCoalId, 'ATSF')
        )
        const terms = EighteenUSAPrivatePowerRules.trackTerms(
            game.hydrated,
            LehighCoalId,
            game.player
        )
        assertExists(terms, 'Lehigh Coal lays track now')
        const stub = RequiredTileEdges.D26
        const construction = privateTrackConstruction(game.hydrated, terms, EighteenUSATrackRules)
        const missing = ['18xx:7', '18xx:8', '18xx:9'].flatMap((definitionId) => {
            const face = EighteenUSATileSet.definitions.find((tile) => tile.id === definitionId)
            assertExists(face, 'A yellow track tile')
            return [0, 1, 2, 3, 4, 5]
                .filter((rotation) => !tileExits(rotateTileFace(face.face, rotation)).has(stub))
                .map((rotation) => ({ definitionId, rotation }))
        })
        expect(missing.length).toBeGreaterThan(0)
        for (const { definitionId, rotation } of missing)
            expect(
                construction.evaluate({
                    companyId: 'ATSF',
                    locationId: 'D26',
                    definitionId,
                    rotation,
                    nodeMapping: {}
                }).reason
            ).toMatch(/toward New York/)
    })

    it('lets the Regional HQ upgrade no second city in a turn with Pettibone & Mulliken', () => {
        const [green] = PlainCityTileIds.green
        const game = operatingCompany(KansasCity, (state) => {
            setPhase(state, '5')
            givePrivate(state, PettiboneMullikenId, 'ATSF')
            givePrivate(state, RegionalHeadquartersId, 'ATSF')
            placeTile(state, StLouis, green)
            placeTile(state, 'D14', green)
            state.trackStep = {
                companyId: 'ATSF',
                completed: false,
                lays: [{ locationId: 'D14', definitionId: green }]
            }
        })
        const terms = EighteenUSAPrivatePowerRules.trackTerms(
            game.hydrated,
            RegionalHeadquartersId,
            game.player
        )
        assertExists(terms, 'The Regional HQ lays track now')
        expect(terms.locationIds).toContain(StLouis)
        const [definitionId] = terms.definitionIds
        expect(
            terms.restriction?.({
                companyId: 'ATSF',
                locationId: StLouis,
                definitionId,
                rotation: 0,
                nodeMapping: {}
            })
        ).toBe('Only one city may be upgraded a turn (P11).')
    })
})

describe('Great Northern (P17)', () => {
    it('lays yellow city tiles at Helena and Fargo', () => {
        const game = operatingCompany(KansasCity, (state) =>
            givePrivate(state, GreatNorthernId, 'ATSF')
        )
        const terms = EighteenUSAPrivatePowerRules.trackTerms(
            game.hydrated,
            GreatNorthernId,
            game.player
        )
        assertExists(terms, 'Great Northern lays track now')
        expect(terms.locationIds).toEqual(expect.arrayContaining(['B8', 'B14']))
        expect(terms.definitionIds).toEqual(expect.arrayContaining(PlainCityTileIds.yellow))
    })
})

describe('bridges (§13.4, P27)', () => {
    it('go on a Company Town placed on a $10 river hex', () => {
        const [town] = CompanyTownTileIds
        const game = operatingCompany(KansasCity, (state) => {
            givePrivate(state, FoxBridgeId, 'ATSF')
            placeTile(state, 'D18', town)
            moveHome(state, 'ATSF', 'D18')
        })
        expect(EighteenUSAMap.location('D18').terrain?.cost).toBe(10)
        expect(
            EighteenUSAPrivatePowerRules.markerTerms?.(game.hydrated, FoxBridgeId, game.player)
                ?.locationIds
        ).toContain('D18')
    })
})

describe('Suem & Wynn (P20)', () => {
    it('joins New York only when neither of its cities has an open slot (RT-1)', () => {
        const game = operatingCompany(KansasCity, (state) => {
            givePrivate(state, SuemWynnId, 'ATSF')
            placeTile(state, 'C29', '18xx:5')
            moveHome(state, 'ATSF', 'C29')
            addCompanyStations(state, 'ATSF', 1)
            placeHome(state, 'BO', { locationId: NewYorkId, nodeId: 'city-0', slot: 0 })
        })
        const inNewYork = () =>
            tokenPositions(game, SuemWynnId).filter((position) => position.locationId === NewYorkId)
        expect(inNewYork()).toEqual([])
        edit(game, (state) =>
            placeHome(state, 'CO', { locationId: NewYorkId, nodeId: 'city-1', slot: 0 })
        )
        expect(inNewYork().length).toBeGreaterThan(0)
    })
})

describe('the Resource subsidy (Subsidy Tiles)', () => {
    it('counts as no subsidy when every resource private is in play', () => {
        const assignment = { E15: 'resource', E17: 'none-1', D14: 'cash-30-1' }
        expect(noSubsidyCityIds(assignment, ['P12', 'P18', 'P24', 'P28'])).toEqual(['E15', 'E17'])
        expect(noSubsidyCityIds(assignment, ['P12', 'P18', 'P24'])).toEqual(['E17'])
    })
})

describe('Regional Headquarters (P16)', () => {
    it('upgrades brown Cleveland, which is no metropolis', () => {
        const game = operatingCompany(KansasCity, (state) => {
            setPhase(state, '5')
            givePrivate(state, RegionalHeadquartersId, 'ATSF')
            placeTile(state, ClevelandId, ClevelandBrownTileId)
        })
        expect(
            EighteenUSAPrivatePowerRules.trackTerms(
                game.hydrated,
                RegionalHeadquartersId,
                game.player
            )?.locationIds
        ).toContain(ClevelandId)
    })
})

describe('Rural Junction (P26)', () => {
    const junctionLays = (phaseId: string) => {
        const game = operatingCompany('H22', (state) => {
            setPhase(state, phaseId)
            givePrivate(state, RuralJunctionId, 'ATSF')
        })
        const terms = EighteenUSAPrivatePowerRules.trackTerms(
            game.hydrated,
            RuralJunctionId,
            game.player
        )
        assertExists(terms, 'Rural Junction lays track')
        const construction = privateTrackConstruction(game.hydrated, terms, EighteenUSATrackRules)
        return terms.locationIds.filter((locationId) => construction.choices(locationId).length)
    }

    it('lays a junction in an empty city hex from phase 5, which takes no green city', () => {
        expect(junctionLays('2')).toEqual(['H20'])
        expect(junctionLays('5')).toEqual(['H20'])
    })
})

describe('American Locomotive (P25)', () => {
    it('closes as the first 6-train is bought, not as phase 6 begins', () => {
        const game = operatingCompany(KansasCity, (state) => {
            givePrivate(state, AmericanLocomotiveId, 'ATSF')
            setPhase(state, '6')
        })
        expect(
            EighteenUSAPrivateRules.phaseEffects(game.hydrated).map(
                (effect) => effect.privateCompanyId
            )
        ).not.toContain(AmericanLocomotiveId)
        expect(EighteenUSATrainRules.privatesClosedByPurchase?.(game.hydrated, 'ATSF')).toEqual([])
        edit(game, (state) => giveTrain(state, 'ATSF', '6'))
        expect(EighteenUSATrainRules.privatesClosedByPurchase?.(game.hydrated, 'ATSF')).toEqual([
            AmericanLocomotiveId
        ])
    })
})

describe('the two resources of B10 and B12 (§13)', () => {
    const atHelena = (privateIds: readonly string[]) => {
        const game = operatingCompany(KansasCity, (state) => {
            companyCash(state, 'ATSF', 500)
            for (const privateId of privateIds) givePrivate(state, privateId, 'ATSF')
            moveHome(state, 'ATSF', 'B8')
        })
        lay(game, 'B8', 'B10')
        return game
    }
    const markersAt = (game: Table, locationId: string) =>
        locationMarkers(game.state, { locationId }).map((marker) => [
            marker.kind,
            marker.privateCompanyId
        ])

    it('lets Keystone Bridge choose its ore token at B10 as it is placed (P21)', () => {
        const game = atHelena([KeystoneBridgeId])
        const terms = EighteenUSAPrivatePowerRules.trackTerms(
            game.hydrated,
            KeystoneBridgeId,
            game.player
        )
        expect(terms?.options?.map((option) => option.id)).toEqual(['coal', 'ore'])
        layPrivate(game, KeystoneBridgeId, 'B10', 'ore')
        expect(markersAt(game, 'B10')).toEqual([[OreMarker, KeystoneBridgeId]])
    })

    it('takes one token from Keystone Bridge and the other from another power', () => {
        const game = atHelena([KeystoneBridgeId, HendricksonIronId])
        layPrivate(game, KeystoneBridgeId, 'B10', 'coal+ore')
        expect(markersAt(game, 'B10')).toEqual([
            [CoalMarker, KeystoneBridgeId],
            [OreMarker, HendricksonIronId]
        ])
    })

    it('lets Keystone Bridge take the ore where its partner holds only coal', () => {
        const game = atHelena([KeystoneBridgeId, LehighCoalId])
        layPrivate(game, KeystoneBridgeId, 'B10', 'coal+ore')
        expect(markersAt(game, 'B10')).toEqual([
            [CoalMarker, LehighCoalId],
            [OreMarker, KeystoneBridgeId]
        ])
    })

    it('places both tokens with one lay when the company holds a power for each', () => {
        const game = atHelena([LehighCoalId, HendricksonIronId])
        layPrivate(game, LehighCoalId, 'B10', 'coal+ore')
        expect(markersAt(game, 'B10')).toEqual([
            [CoalMarker, LehighCoalId],
            [OreMarker, HendricksonIronId]
        ])
        expect(getCompany(game.state, LehighCoalId).closed).toBe(true)
        expect(getCompany(game.state, HendricksonIronId).closed).toBe(true)
    })
})

describe('American Locomotive’s discount (P25)', () => {
    it('takes 10% off its company’s bank trains, Pullmans too, and no other company’s', () => {
        const game = operatingCompany(KansasCity, (state) =>
            givePrivate(state, AmericanLocomotiveId, 'ATSF')
        )
        const price = (companyId: string, definitionId: string, printed: number) =>
            EighteenUSATrainRules.bankPrice?.(game.hydrated, companyId, definitionId, printed)
        expect([price('ATSF', '4', 300), price('ATSF', 'P', 150), price('BO', '4', 300)]).toEqual([
            270, 135, 300
        ])
    })
})
