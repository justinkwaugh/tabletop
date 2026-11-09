import {
    revenueStagesByPhase,
    type FleetRules,
    type FleetTrainPolicy,
    type TrainDefinition,
    type TrainRunningState,
    type RouteRules
} from '@tabletop/18xx'
import {
    LondonSpacesLocationId,
    Map1862,
    OffboardAreas,
    OffboardAreaIds,
    offboardArea
} from './map.js'
import { permitsOf } from './operating.js'
import { TileSet1862 } from './tiles.js'
import { Phases1862, TrainDepot1862, paidStops, permanentFreight, trainFace } from './trains.js'

export const revenueStages = revenueStagesByPhase(Phases1862, 'A-B', [
    ['C-D', 'C'],
    ['E-H', 'E']
])

export const FreightBonus = 20
export const PortFreightBonus = 30
export const LocalSubsidy = 10
const kindOf = (train: TrainDefinition) => trainFace(train.id).kind

function hasLondonStation(state: TrainRunningState, companyId: string): boolean {
    return state.stations.some(
        (station) =>
            station.companyId === companyId &&
            station.status === 'placed' &&
            station.position.locationId === LondonSpacesLocationId
    )
}

const offboardStops = Map1862.definition.locations.flatMap((location) =>
    location.preprintedTile.nodes.flatMap((node) =>
        node.kind === 'offboard' ? [{ locationId: location.id, nodeId: node.id }] : []
    )
)

export const FleetRules1862: FleetRules = {
    sharedTrack: true,
    payOnce: {
        groups: OffboardAreaIds.map((area) =>
            offboardStops.filter((stop) => offboardArea(stop.locationId, stop.nodeId) === area)
        )
    },
    connectivity: { at: 'city', root: 'home' },
    routeShape: { endKinds: ['city', 'offboard'], minimumCities: 1 },
    trains: Object.fromEntries(
        TrainDepot1862.definition.trains.map((train): [string, FleetTrainPolicy] => {
            const kind = kindOf(train)
            const count = paidStops(train.id)
            return [
                train.id,
                {
                    payingKinds:
                        kind === 'local' ? ['city', 'town', 'offboard'] : ['city', 'offboard'],
                    ...(count === undefined
                        ? {}
                        : { payingStopLimit: { count, kinds: ['city', 'offboard'] } }),
                    ...(kind === 'local' ? { hexSubsidy: LocalSubsidy } : {}),
                    ...(kind === 'freight'
                        ? { freight: permanentFreight(train.id) ? 'optional' : 'required' }
                        : {})
                }
            ]
        })
    ),
    freightChains: {
        bonusPerHex: FreightBonus,
        offboardDistance: 'adjacent-hex',
        endRates: [
            {
                stops: offboardStops.filter((stop) => {
                    const area = offboardArea(stop.locationId, stop.nodeId)
                    return area && OffboardAreas[area].kind === 'port'
                }),
                bonusPerHex: PortFreightBonus
            }
        ]
    }
}

export const RouteRules1862: RouteRules = {
    map: Map1862,
    tileSet: TileSet1862,
    depot: TrainDepot1862,
    revenueStage: (state) => revenueStages(state.phaseId),
    requiresCity: () => false,
    // A company runs only the kinds of train it holds a permit for (§6.5.4.3).
    canRunTrain: (state, train) =>
        train.status === 'owned' &&
        train.owner.kind === 'company' &&
        permitsOf(state, train.owner.companyId).includes(trainFace(train.definitionId).kind),
    // London only with a London station; Local trains no off-boards (§7.4, §7.8.2).
    stopAllowed(state, companyId, center, train) {
        const area = offboardArea(center.locationId, center.nodeId)
        if (area === 'london' && !hasLondonStation(state, companyId)) return false
        if (area && train && kindOf(train) === 'local') return false
        return true
    },
    fleet: FleetRules1862
}
