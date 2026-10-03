import type { EighteenSeventeenState } from './state.js'
import type { TrainRunningState } from '@tabletop/18xx'
import { locationMarkers, type RouteRules } from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { BridgeMarker, MineMarker, RanchMarker } from './privatePowerRules.js'
import { eighteenSeventeenOptions } from './state.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenPhases, EighteenSeventeenTrainDepot } from './trains.js'

// Every route earns this for each mine or ranch hex it passes through.
const HexMarkerBonuses: Readonly<Record<string, number>> = { [MineMarker]: 10, [RanchMarker]: 10 }
const BridgeBonus = 10
// With Modern Trains, what a train earns more at each city with its company's station.
const ModernTrainBonus: Readonly<Record<string, number>> = { '7': 10, '8': 20 }

export const EighteenSeventeenRouteRules: RouteRules = {
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    depot: EighteenSeventeenTrainDepot,
    revenueStage: (state) => EighteenSeventeenPhases.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    oneStopPerHex: true,
    hexBonus: (state, locationId) =>
        locationMarkers(state, { locationId }).reduce(
            (sum, marker) => sum + (HexMarkerBonuses[marker.kind] ?? 0),
            0
        ),
    stopBonus(
        state: TrainRunningState & Pick<EighteenSeventeenState, 'modernTrains'>,
        train,
        companyId,
        center
    ) {
        const bridge = locationMarkers(state, { locationId: center.locationId, kind: BridgeMarker })
            .length
            ? BridgeBonus
            : 0
        const modern = ModernTrainBonus[train.id]
        const ownStation = state.stations.some(
            (station) =>
                station.status === 'placed' &&
                station.companyId === companyId &&
                station.position.locationId === center.locationId &&
                station.position.nodeId === center.nodeId
        )
        return (
            bridge +
            (modern && ownStation && eighteenSeventeenOptions(state).modernTrains ? modern : 0)
        )
    }
}
