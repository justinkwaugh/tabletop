import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import type { StationState, TileInventory, Train, TrainRunningState } from '@tabletop/18xx'
import {
    TestCompanyId,
    TestTrackHomeLocationId,
    minimalPlayState,
    minimalRouteRules,
    minimalTrackMap
} from '@tabletop/18xx/testing'
import { createMapDrawing } from '../maps/mapDrawing.js'
import type { RouteSolution } from '../routes/latestRouteSolver.js'
import {
    ProjectedRunModule,
    type ProjectedRunMap,
    type ProjectedRunSession
} from './projectedRunModule.svelte.js'

const train: Train = {
    id: '2-1',
    definitionId: '2',
    status: 'owned',
    owner: { kind: 'company', companyId: TestCompanyId }
}
const previewInventory: TileInventory = { placements: {}, retiredPieceIds: [] }
const previewStations: StationState = {
    stations: [
        {
            id: 'station',
            companyId: TestCompanyId,
            status: 'placed',
            position: { locationId: TestTrackHomeLocationId, nodeId: 'city', slot: 0 }
        }
    ],
    stationReservations: []
}
const scene = createMapDrawing(minimalTrackMap)

function solution(revenue: number, pathId = 'edge-0'): RouteSolution {
    return {
        result: {
            companyId: TestCompanyId,
            revenue,
            routes: [
                {
                    trainId: train.id,
                    start: { locationId: TestTrackHomeLocationId, nodeId: 'city' },
                    paths: [{ locationId: TestTrackHomeLocationId, pathId }],
                    definitionId: train.definitionId,
                    visits: [],
                    payments: [],
                    distance: 1,
                    revenue
                }
            ]
        },
        exhaustive: true
    }
}

function projected({
    machineState = 'LayingTrack',
    valid = ['FinishTrack'],
    trains = [train]
}: { machineState?: string; valid?: string[]; trains?: Train[] } = {}) {
    const game = $state({
        machineState,
        trackStep: { companyId: TestCompanyId, lays: [], completed: false },
        stationStep: { companyId: TestCompanyId, placedStationIds: [], completed: false },
        viewingHistory: false
    })
    const snapshot: TrainRunningState = {
        ...minimalPlayState(),
        trainInventory: { trains, nextTrainNumber: 2 }
    }
    const session: ProjectedRunSession = {
        get state() {
            return game
        },
        rules: { routeRules: minimalRouteRules },
        validActionTypes: valid,
        get viewingHistory() {
            return game.viewingHistory
        }
    }
    const map = $state<ProjectedRunMap>({
        displayedTileInventory: snapshot.tileInventory,
        displayedStationState: { stations: [], stationReservations: [] },
        displayedScene: scene
    })
    const module = new ProjectedRunModule(session, map, () => snapshot)
    function request() {
        assertExists(module.request, 'The company projects a run')
        return module.request
    }
    return { module, game, map, request }
}

describe('ProjectedRunModule', () => {
    it('projects the run of the company laying track or placing a station', () => {
        expect(projected().module.companyId).toBe(TestCompanyId)
        expect(
            projected({ machineState: 'PlacingStation', valid: ['PlaceStation'] }).module.companyId
        ).toBe(TestCompanyId)
        expect(
            projected({ machineState: 'RunningTrains', valid: ['RunTrains'] }).module.companyId
        ).toBeUndefined()
    })

    it('projects nothing for someone who is not constructing, or while viewing history', () => {
        expect(projected({ valid: [] }).module.request).toBeUndefined()
        const { module, game } = projected()
        game.viewingHistory = true
        expect(module.request).toBeUndefined()
    })

    it('projects nothing for a company without trains', () => {
        expect(projected({ trains: [] }).module.request).toBeUndefined()
    })

    it('asks for the run of the operating company with its trains', () => {
        expect(projected().module.request).toMatchObject({
            companyId: TestCompanyId,
            trains: [train],
            state: { routeStep: { companyId: TestCompanyId } }
        })
    })

    it('runs on the previewed tile and stations', () => {
        const { module, map } = projected()
        map.displayedTileInventory = previewInventory
        map.displayedStationState = previewStations
        expect(module.request?.state.tileInventory).toEqual(previewInventory)
        expect(module.request?.state.stations).toEqual(previewStations.stations)
    })

    it('keeps the last solved run while a newer preview is solved', () => {
        const { module, map, request } = projected()
        const solved = solution(30)
        module.setSolved(request(), solved)
        expect(module.latest?.solution).toBe(solved)
        expect(module.current).toBe(true)
        map.displayedTileInventory = previewInventory
        expect(module.latest?.solution).toBe(solved)
        expect(module.current).toBe(false)
    })

    it('forgets the run once the company stops operating', () => {
        const { module, game, request } = projected()
        module.setSolved(request(), solution(30))
        game.machineState = 'RunningTrains'
        expect(module.latest).toBeUndefined()
        game.machineState = 'LayingTrack'
        expect(module.latest).toBeUndefined()
    })

    it('keeps the run from the company’s track step into its station step', () => {
        const { module, game, request } = projected()
        const solved = solution(30)
        module.setSolved(request(), solved)
        game.machineState = 'PlacingStation'
        expect(module.latest?.solution).toBe(solved)
    })

    it('shows nothing once a solve fails', () => {
        const { module, request } = projected()
        module.setSolved(request(), solution(30))
        module.setFailed(request())
        expect(module.latest).toBeUndefined()
    })

    it('ignores a run solved for another company', () => {
        const { module, request } = projected()
        module.setSolved({ ...request(), companyId: 'other' }, solution(10))
        expect(module.latest).toBeUndefined()
    })

    it('draws the run only while all its track is on the displayed map', () => {
        const { module, request } = projected()
        module.setSolved(request(), solution(30))
        expect(module.overlays).toMatchObject([{ id: train.id, segments: [{ pathId: 'edge-0' }] }])
        module.setSolved(request(), solution(30, 'missing'))
        expect(module.overlays).toEqual([])
    })
})
