import { TrainDepot, type TileRotation, type TrainRunningState } from '@tabletop/18xx'
import { TileSet1833NE } from '../src/tiles.js'
import { TrainDepot1833NE } from '../src/trains.js'
import type { State1833NE } from '../src/state.js'
import { table } from './table.js'

export type Placement = { locationId: string; definitionId: string; rotation: TileRotation }

/** The opening state with tiles, stations and a company's trains put in place for route tests. */
export function position(
    tiles: readonly Placement[],
    stations: readonly { companyId: string; locationId: string; nodeId?: string }[],
    trains: Readonly<Record<string, readonly string[]>>,
    phaseId = 'I'
): State1833NE & TrainRunningState {
    const state = structuredClone(table(4).state)
    state.phaseId = phaseId
    state.tileInventory = TileSet1833NE.createInventory(tiles)
    for (const [index, entry] of stations.entries()) {
        const station = state.stations.find(
            (candidate) =>
                candidate.companyId === entry.companyId && candidate.status === 'available'
        )
        if (!station) throw new Error(`${entry.companyId} has no station left`)
        state.stations[state.stations.indexOf(station)] = {
            id: station.id,
            companyId: entry.companyId,
            status: 'placed',
            position: {
                locationId: entry.locationId,
                nodeId: entry.nodeId ?? 'city',
                slot: index % 1
            }
        }
    }
    for (const [companyId, definitionIds] of Object.entries(trains))
        for (const definitionId of definitionIds)
            give(TrainDepot1833NE, state, companyId, definitionId)
    return state
}

function give(depot: TrainDepot, state: State1833NE, companyId: string, definitionId: string) {
    const supplied = depot.certificateDefinitions(definitionId)[0]
    const train = depot.nextTrain(state.trainInventory, supplied)
    if (!train) throw new Error(`No ${definitionId} left`)
    depot.purchase(state.trainInventory, train.id, definitionId, { kind: 'company', companyId })
}
