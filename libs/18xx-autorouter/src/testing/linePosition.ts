import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    TileSet,
    TrainDepot,
    type RouteRules,
    type TileFace,
    type TrainDefinition,
    type TrainDistance,
    type TrainRunningState
} from '@tabletop/18xx'

/** A train of the test depot: its distance alone, or with what else its definition declares. */
export type LineTrain =
    TrainDistance | (Pick<TrainDefinition, 'distance'> & Partial<TrainDefinition>)

function lineTrain(train: LineTrain, id: number): TrainDefinition {
    return 'distance' in train
        ? { id: String(id), name: String(id), price: 0, ...train }
        : { id: String(id), name: String(id), price: 0, distance: train }
}

/**
 * Company A, with a station in the first hex's city and one train of each kind, on a line of
 * hexes running south: hex ``r`` meets hex ``r + 1`` across its side 0.
 */
export function linePosition(
    faces: TileFace[],
    trains: readonly LineTrain[],
    stopGroups: Readonly<Record<number, string>> = {},
    routeRules: Partial<RouteRules> = {}
) {
    const tileSet = new TileSet({ id: 'empty', entries: [] }, [])
    const depot = new TrainDepot({
        id: 'test',
        trains: trains.map(lineTrain),
        supply: []
    })
    const rules: RouteRules = {
        map: new RailwayMap({
            id: 'test',
            name: 'Test',
            orientation: HexOrientation.Flat,
            locations: faces.map((preprintedTile, r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                preprintedTile,
                buildable: true,
                ...(stopGroups[r] ? { stopGroup: stopGroups[r] } : {})
            }))
        }),
        tileSet,
        depot,
        requiresCity: (train) => train.distance.measure === 'cities-and-offboards',
        revenueStage: (state) => [state.phaseId],
        ...routeRules
    }
    const state: TrainRunningState = {
        bank: {},
        companies: [{ id: 'A', kind: 'major', shareCount: 10 }],
        cash: [],
        certificates: [],
        certificatePools: [],
        stations: [
            {
                id: 'home',
                companyId: 'A',
                status: 'placed',
                position: { locationId: '0', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [],
        tileInventory: tileSet.createInventory(),
        trainInventory: {
            depotId: 'test',
            nextTrainNumber: 1,
            trains: trains.map((_, id) => ({
                id: String(id),
                definitionId: String(id),
                status: 'owned',
                owner: { kind: 'company', companyId: 'A' }
            }))
        },
        phaseId: 'yellow',
        routeStep: { companyId: 'A' }
    }
    return { state, rules }
}
