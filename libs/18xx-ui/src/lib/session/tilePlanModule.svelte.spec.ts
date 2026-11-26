import { describe, expect, it } from 'vitest'
import {
    RailwayMap,
    StandardTileCatalog,
    TileSet,
    TrackConstruction,
    createSeparateCitiesTileFace,
    createTrackTileFace,
    type TileInventory,
    type TrackRules
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    TestTrackHomeLocationId,
    minimalPlayState,
    minimalTrackMap,
    minimalTrackRules,
    minimalTrackTileSet
} from '@tabletop/18xx/testing'
import { TilePlanModule, type TilePlanSession } from './tilePlanModule.svelte.js'
import { testSession } from './moduleTestSession.js'

// The home hex's green city runs track out of edges 0 and 3 (minimalTrackMap).
const BesideHome = '0,-1'
const AcrossHome = '0,1'
const AwayFromTrack = '2,-2'

type Board = { map: RailwayMap; rules: TrackRules; tileSet: TileSet; tileGroups?: string[][] }

function planning(
    board: Board = {
        map: minimalTrackMap,
        rules: minimalTrackRules(),
        tileSet: minimalTrackTileSet
    },
    inventory: (tileSet: TileSet) => TileInventory = (tileSet) => tileSet.createInventory()
) {
    const state: TilePlanSession['state'] = {
        ...minimalPlayState(),
        tileInventory: inventory(board.tileSet)
    }
    const harness = testSession(state, { trackRules: board.rules }, [])
    let enabled = $state(true)
    const plan = new TilePlanModule(
        harness.session,
        () => ({ map: board.map, tileSet: board.tileSet, tileGroups: board.tileGroups }),
        () => enabled
    )
    return {
        plan,
        setEnabled(value: boolean) {
            enabled = value
        }
    }
}

function laidOn(inventory: TileInventory | undefined, locationId: string) {
    const placement = inventory?.placements[locationId]
    assertExists(placement, `A tile lies on ${locationId}`)
    return placement
}

describe('TilePlanModule', () => {
    it('opens on hexes track runs into, never on bare hexes away from track', () => {
        const { plan } = planning()
        expect(plan.locationIds).toContain(BesideHome)
        expect(plan.locationIds).toContain(AcrossHome)
        expect(plan.locationIds).not.toContain(AwayFromTrack)
        // No tile of the set replaces the home hex's green city.
        expect(plan.locationIds).not.toContain(TestTrackHomeLocationId)

        plan.tap(AwayFromTrack)
        expect(plan.locationId).toBeUndefined()
        plan.tap(BesideHome)
        expect(plan.locationId).toBe(BesideHome)
        expect(plan.choices.map((choice) => [choice.level, choice.tile.id])).toEqual([
            [0, '18xx:8'],
            [0, '18xx:9']
        ])
    })

    it('lays a tried tile on its hex, turns it on a tap, and closes on a tap away', () => {
        const { plan } = planning()
        plan.tap(BesideHome)
        plan.choose(0, '18xx:9')
        const first = laidOn(plan.inventory, BesideHome)
        expect(first.definitionId).toBe('18xx:9')
        expect(plan.previewedLocationId).toBe(BesideHome)
        expect(plan.choices.find((choice) => choice.chosen)?.tile.id).toBe('18xx:9')

        plan.tap(BesideHome)
        expect(laidOn(plan.inventory, BesideHome).rotation).not.toBe(first.rotation)

        plan.choose(0, '18xx:8')
        expect(laidOn(plan.inventory, BesideHome).definitionId).toBe('18xx:8')

        plan.tap(AwayFromTrack)
        expect(plan.locationId).toBeUndefined()
        expect(plan.inventory).toBeUndefined()
    })

    it('offers a tile the supply has run out of, but never lays it', () => {
        const { plan } = planning(undefined, (tileSet) => {
            const inventory = tileSet.createInventory()
            for (const [locationId, pieceId] of [
                ['2,0', 'test-track/straight/1'],
                ['-2,0', 'test-track/straight/2']
            ])
                inventory.placements[locationId] = {
                    pieceId,
                    definitionId: '18xx:9',
                    rotation: 0
                }
            return inventory
        })
        plan.tap(BesideHome)
        const straight = plan.choices.find((choice) => choice.tile.id === '18xx:9')
        expect(straight?.available).toBe(false)
        expect(() => plan.choose(0, '18xx:9')).toThrow('Choose a tile the supply still has')
    })

    it('never offers a tile a way the title forbids for good', () => {
        const rules: TrackRules = {
            ...minimalTrackRules(),
            placementRestriction: (placement) =>
                placement.definitionId === '18xx:9' && placement.rotation !== 0
                    ? 'Straight track lies only as printed'
                    : undefined
        }
        const lays = new TrackConstruction(
            { ...minimalPlayState(), tileInventory: minimalTrackTileSet.createInventory() },
            rules
        ).futureLays(BesideHome)
        expect(
            lays.filter((lay) => lay.definitionId === '18xx:9').map((lay) => lay.rotation)
        ).toEqual([0])
    })

    it('offers a rotation when any way of keeping the cities passes the title', () => {
        const tileSet = new TileSet(
            {
                id: 'test-two-city',
                entries: [{ id: 'oo', faceDefinitionIds: ['18xx:59'], count: 1 }]
            },
            [StandardTileCatalog]
        )
        const map = new RailwayMap({
            ...minimalTrackMap.definition,
            locations: minimalTrackMap.definition.locations.map((location) =>
                location.id === BesideHome
                    ? {
                          ...location,
                          preprintedTile: createSeparateCitiesTileFace(
                              'yellow',
                              [
                                  { edges: [], revenue: 0, stationSlots: 1 },
                                  { edges: [], revenue: 0, stationSlots: 1 }
                              ],
                              ['OO']
                          )
                      }
                    : location
            )
        })
        const rotations = (rules: TrackRules) =>
            new TrackConstruction(
                { ...minimalPlayState(), tileInventory: tileSet.createInventory() },
                rules
            )
                .futureLays(BesideHome)
                .map((lay) => lay.rotation)
        const free: TrackRules = { ...minimalTrackRules(tileSet), map }
        const kept: TrackRules = {
            ...free,
            placementRestriction: (placement) =>
                placement.nodeMapping['city-0'] === 'city-1'
                    ? undefined
                    : 'The first city moves to the second'
        }
        expect(rotations(free).length).toBeGreaterThan(0)
        expect(rotations(kept)).toEqual(rotations(free))
    })

    it('ranks tiles by exits among those the supply still has', () => {
        const tileSet = new TileSet(
            {
                id: 'test-exits',
                entries: [
                    { id: 'three', faceDefinitionIds: ['18xx:23'], count: 1 },
                    { id: 'four', faceDefinitionIds: ['18xx:20'], count: 1 }
                ]
            },
            [StandardTileCatalog]
        )
        const map = new RailwayMap({
            ...minimalTrackMap.definition,
            locations: minimalTrackMap.definition.locations.map((location) =>
                location.id === BesideHome
                    ? { ...location, preprintedTile: createTrackTileFace('yellow', [[0, 3]]) }
                    : location
            )
        })
        const rules: TrackRules = {
            ...minimalTrackRules(tileSet),
            map,
            colorOrder: ['white', 'yellow', 'green'],
            mostExits: () => true
        }
        const offered = (inventory: TileInventory) =>
            new Set(
                new TrackConstruction({ ...minimalPlayState(), tileInventory: inventory }, rules)
                    .futureLays(BesideHome)
                    .map((lay) => `${lay.definitionId}${lay.placement ? '' : ' (none left)'}`)
            )
        expect(offered(tileSet.createInventory())).toEqual(new Set(['18xx:20']))
        const fourUsed = tileSet.createInventory()
        fourUsed.placements['2,0'] = {
            pieceId: 'test-exits/four/1',
            definitionId: '18xx:20',
            rotation: 0
        }
        expect(offered(fourUsed)).toEqual(new Set(['18xx:23', '18xx:20 (none left)']))
    })

    it('lays a piece across every hex it covers, from the hex the title lays it from', () => {
        const Partner = '1,-1'
        const rules: TrackRules = {
            ...minimalTrackRules(),
            placementRestriction: (placement) =>
                placement.locationId === Partner
                    ? 'The piece is laid from its first hex'
                    : undefined,
            companionTiles: (_state, details) =>
                details.locationId === BesideHome
                    ? [{ locationId: Partner, definitionId: details.definitionId, rotation: 0 }]
                    : []
        }
        const { plan } = planning({
            map: minimalTrackMap,
            rules,
            tileSet: minimalTrackTileSet,
            tileGroups: [[BesideHome, Partner]]
        })
        plan.tap(Partner)
        expect(plan.locationId).toBe(BesideHome)
        expect(plan.pieceLocationIds).toEqual([BesideHome, Partner])
        expect(plan.choices[0]?.piece?.map((tile) => tile.locationId)).toEqual([
            BesideHome,
            Partner
        ])
        plan.choose(0, '18xx:8')
        expect(laidOn(plan.inventory, Partner).definitionId).toBe('18xx:8')
        plan.tap(Partner)
        expect(plan.locationId).toBe(BesideHome)
    })

    it('closes while another choice takes the map, and stays closed after', () => {
        const { plan, setEnabled } = planning()
        plan.tap(BesideHome)
        plan.choose(0, '18xx:9')
        setEnabled(false)
        expect(plan.locationId).toBeUndefined()
        expect(plan.locationIds).toEqual([])
        setEnabled(true)
        expect(plan.locationId).toBeUndefined()
        expect(plan.inventory).toBeUndefined()
    })
})
