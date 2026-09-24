import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestTrackHomeLocationId,
    minimalPlayState,
    minimalRouteRules,
    minimalStationRules,
    minimalTrackMap,
    minimalTrackRules,
    straightOnlyTrackTileSet
} from '@tabletop/18xx/testing'
import type { MapViewDefinition } from '../maps/stationPresentation.js'
import { MapModule } from './mapModule.svelte.js'
import { RoutesModule } from './routesModule.svelte.js'
import { StationsModule } from './stationsModule.svelte.js'
import { TrackModule } from './trackModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const tileSet = straightOnlyTrackTileSet
const view: MapViewDefinition = {
    map: minimalTrackMap,
    tileSet,
    stations: { [TestCompanyId]: { color: '#123456', label: TestCompanyId } }
}
const rules = {
    trackRules: minimalTrackRules(tileSet),
    privatePowerRules: { trackTerms: () => undefined, earlyTrainCompany: () => undefined },
    stationRules: { ...minimalStationRules, map: minimalTrackMap, tileSet },
    routeRules: { ...minimalRouteRules, map: minimalTrackMap, tileSet }
}

function table(machineState: 'LayingTrack' | 'StockRound', valid: string[], availability = {}) {
    const base = minimalPlayState()
    const state = {
        ...base,
        machineState,
        companies: base.companies.map((company) => ({ ...company, floated: true })),
        cash: [
            ...base.cash,
            { owner: { kind: 'company' as const, companyId: TestCompanyId }, amount: 100 }
        ],
        tileInventory: tileSet.createInventory(),
        trackStep: { companyId: TestCompanyId, lays: [], completed: false },
        usedPrivatePowerIds: [],
        stations: [
            {
                id: `${TestCompanyId}:home`,
                companyId: TestCompanyId,
                status: 'placed' as const,
                position: { locationId: TestTrackHomeLocationId, nodeId: 'city', slot: 0 }
            }
        ]
    }
    const { session } = testSession(state, rules, valid, availability)
    const track = new TrackModule(
        session,
        () => view,
        { selection: undefined, trackPowerSelection: undefined },
        { selectPrivateTile: () => {}, confirm: async () => {} },
        () => {
            map.clearInspection()
        }
    )
    const stations = new StationsModule(
        session,
        () => {
            map.clearInspection()
        },
        () => false
    )
    const routes = new RoutesModule(
        session,
        (selection) => {
            map.inspect(selection)
        },
        () => map.networkRoutes
    )
    const map: MapModule = new MapModule(session, () => view, track, stations, routes)
    return { map, track }
}

describe('MapModule', () => {
    it('draws every map location and the placed station tokens', () => {
        const { map } = table('StockRound', [])
        expect(map.scene.locations).toHaveLength(minimalTrackMap.definition.locations.length)
        expect(map.tokens).toMatchObject([
            { locationId: TestTrackHomeLocationId, label: TestCompanyId }
        ])
    })

    it('inspects a clicked location when no action claims the click', () => {
        const { map } = table('StockRound', [])
        map.select({ kind: 'hex', locationId: '1,0' })
        expect(map.selection).toEqual({ kind: 'hex', locationId: '1,0' })
        map.clearInspection()
        expect(map.selection).toBeUndefined()
        map.select({ kind: 'hex', locationId: '1,0' }, false)
        expect(map.selection).toBeUndefined()
    })

    it('rejects an inspection of something that is not on the map', () => {
        expect(() =>
            table('StockRound', []).map.inspect({ kind: 'hex', locationId: 'nowhere' })
        ).toThrow()
    })

    it('gives a click to track laying first, and never inspects while track choices show', () => {
        const { map, track } = table('LayingTrack', ['LayTile', 'FinishTrack'])
        const [buildable] = track.locationIds
        map.select({ kind: 'hex', locationId: '2,0' })
        expect(map.selection).toBeUndefined()
        map.select({ kind: 'hex', locationId: buildable })
        expect(track.selection.locationId?.value).toBe(buildable)
        expect(map.selection).toEqual({ kind: 'hex', locationId: buildable })
    })

    it('shows the previewed tile on the displayed scene without changing the committed scene', () => {
        const { map, track } = table('LayingTrack', ['LayTile', 'FinishTrack'])
        const [buildable] = track.locationIds
        const face = (scene: typeof map.scene) =>
            scene.locations.find((entry) => entry.location.id === buildable)?.face
        map.select({ kind: 'hex', locationId: buildable })
        expect(track.tileInFlight).toBe(true)
        expect(map.displayedScene).toBe(map.scene)
        track.tileInFlight = false
        expect(face(map.displayedScene)?.paths.length).toBe(1)
        expect(face(map.scene)?.paths.length).toBe(0)
    })

    it('overlays the inspected company network, and hides it on request or under a track preview', () => {
        const { map, track } = table('LayingTrack', ['LayTile', 'FinishTrack'])
        expect(map.networkCompanyId).toBe(TestCompanyId)
        expect(map.networkRoutes).toMatchObject([{ id: 'track-access' }])
        map.select({ kind: 'hex', locationId: track.locationIds[0] })
        expect(map.networkRoutes).toEqual([])
        track.cancel()
        map.showTrackAccess = false
        expect(map.networkRoutes).toEqual([])
        expect(() => map.inspectCompanyNetwork('missing')).toThrow()
    })

    it('hides the selection and the network overlay while state is publishing', () => {
        const { map } = table('StockRound', [], { publishing: true })
        map.inspect({ kind: 'hex', locationId: '1,0' })
        expect(map.selection).toBeUndefined()
        expect(map.networkRoutes).toEqual([])
    })

    it('keeps a map style per player', () => {
        const { map } = table('StockRound', [])
        expect(map.style).toBe('classic')
        map.setStyle('muted')
        expect(map.style).toBe('muted')
    })
})
