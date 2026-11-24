import {
    locationMarkers,
    type RevenueCenter,
    type RouteRevenuePolicy,
    type RouteRules,
    type TrainDefinition,
    type TrainRunningState
} from '@tabletop/18xx'
import type { EighteenUSAState } from './state.js'
import { EighteenUSAMap } from './map.js'
import { EighteenUSATileSet, RuralJunctionTileIds, isCompanyTown } from './tiles.js'
import {
    EighteenUSAPhases,
    EighteenUSATrainDepot,
    PullmanStopBonus,
    PullmanTrainId
} from './trains.js'
import {
    BridgeMarker,
    CoalMarker,
    ExpressFreightMarker,
    OilMarker,
    OreMarker,
    RichOreMarker,
    ResourceMarkerKinds
} from './resourceMarkers.js'
import { BridgeTokenValue, ResourceTokens } from './resources.js'
import { ExpressFreightId, GreatNorthernId, companyHolding } from './privateHolders.js'
import { redAreaOf } from './redAreas.js'
import { subsidy } from './subsidyRules.js'
import { assignedDefinition, switcherPayingStops } from './trainAssignments.js'

type RouteState = TrainRunningState & Pick<EighteenUSAState, 'cityBonuses'>

const RaisedPhaseId = '5'
const PullmanSuffix = `+${PullmanTrainId}`

const MarkerValues: Readonly<Record<string, (state: TrainRunningState) => number>> = {
    [CoalMarker]: () => ResourceTokens.coal.value,
    [OreMarker]: () => ResourceTokens.ore.value,
    [RichOreMarker]: () => ResourceTokens.ore.raised?.value ?? ResourceTokens.ore.value,
    [OilMarker]: (state) => {
        const { value, raised } = ResourceTokens.oil
        return raised &&
            'phaseId' in raised.when &&
            EighteenUSAPhases.isAtLeast(state.phaseId, raised.when.phaseId)
            ? raised.value
            : value
    }
}

/** Whether a coal, oil or ore token lies in the hex, which a train passes only once (§13). */
function holdsResource(state: TrainRunningState, locationId: string): boolean {
    return locationMarkers(state, { locationId }).some((marker) =>
        ResourceMarkerKinds.includes(marker.kind)
    )
}

/** Each resource token pays every route passing its hex once: oil $20 from phase 5 (§13). */
function resourceBonus(state: TrainRunningState, locationId: string): number {
    return locationMarkers(state, { locationId }).reduce(
        (sum, marker) => sum + (MarkerValues[marker.kind]?.(state) ?? 0),
        0
    )
}

/** A city's +10 or +10/+20 subsidy token (§11.6.1). */
function cityBonus(state: RouteState, locationId: string): number {
    const subsidyId = state.cityBonuses?.[locationId]
    if (!subsidyId) return 0
    const effect = subsidy(subsidyId).effect
    if (effect.kind !== 'city-bonus') return 0
    return EighteenUSAPhases.isAtLeast(state.phaseId, RaisedPhaseId)
        ? effect.fromPhase5Value
        : effect.value
}

function isRuralJunction(state: TrainRunningState, locationId: string): boolean {
    const placement = state.tileInventory.placements[locationId]
    return !!placement && RuralJunctionTileIds.includes(placement.definitionId)
}

/** A train drawing a Pullman earns $20 more at every city and red area it visits (§12.7). */
function pullmanBonus(state: TrainRunningState, train: TrainDefinition, center: RevenueCenter) {
    return train.id.endsWith(PullmanSuffix) && !isRuralJunction(state, center.locationId)
        ? PullmanStopBonus
        : 0
}

const CompanyTownPenalty = 10
const ExpressFreightBonus = 10
const GreatNorthernBonus = 30
const [Fargo, Helena] = ['B14', 'B8']
const [Seattle, Chicago] = ['B2', 'D20']

/**
 * The Great Northern's company earns $30 once a run for a train to Fargo and Helena, and $30
 * more if that train also runs to Seattle and Chicago (P17).
 */
function greatNorthernPolicy(state: TrainRunningState, companyId: string): RouteRevenuePolicy {
    if (companyHolding(state, GreatNorthernId) !== companyId) return {}
    const once = { oncePerRun: true as const, sourceId: GreatNorthernId }
    return {
        connectionBonuses: [
            { from: { [Fargo]: 0 }, to: { [Helena]: GreatNorthernBonus }, ...once },
            {
                from: { [Seattle]: 0 },
                to: { [Chicago]: GreatNorthernBonus },
                requires: [Fargo, Helena],
                ...once
            }
        ]
    }
}

function hasOwnStation(state: TrainRunningState, companyId: string, locationId: string) {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            station.position.locationId === locationId
    )
}

/** P8's company earns $10 more for each train that runs to its red area (P8). */
function expressFreightBonus(state: TrainRunningState, companyId: string, locationId: string) {
    if (companyHolding(state, ExpressFreightId) !== companyId) return 0
    const [marker] = locationMarkers(state, { kind: ExpressFreightMarker })
    const area = marker && redAreaOf(marker.locationId)
    return area?.locationIds.includes(locationId) ? ExpressFreightBonus : 0
}

export const EighteenUSARouteRules: RouteRules = {
    map: EighteenUSAMap,
    tileSet: EighteenUSATileSet,
    depot: EighteenUSATrainDepot,
    revenueStage: (state) => EighteenUSAPhases.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    oneStopPerHex: true,
    // No more than two of a company's trains run to Mexico (§12.4.1).
    stopGroupRouteLimits: { mexico: 2 },
    hexBonus: (state, locationId) => resourceBonus(state, locationId),
    // A train passes a resource tile once, however many exits it has (BGG ruling RT-5).
    forbidsHexReentry: (state, locationId) => holdsResource(state, locationId),
    stopBonus(state: RouteState, train, companyId, center) {
        const bridge = locationMarkers(state, {
            locationId: center.locationId,
            kind: BridgeMarker
        }).length
            ? BridgeTokenValue
            : 0
        return (
            bridge +
            cityBonus(state, center.locationId) +
            pullmanBonus(state, train, center) +
            expressFreightBonus(state, companyId, center.locationId)
        )
    },
    // A Company Town is worth $10 less to a company without its station there (P27).
    stopRevenue: (state, companyId, center, printed) =>
        isCompanyTown(state.tileInventory, center.locationId) &&
        !hasOwnStation(state, companyId, center.locationId)
            ? printed - CompanyTownPenalty
            : printed,
    // A Company Town never blocks a route, its station being the only one (BGG ruling PR-27).
    passesStations: (state, _companyId, center) =>
        isCompanyTown(state.tileInventory, center.locationId),
    revenuePolicy(train, state, companyId) {
        const payingStopLimit = switcherPayingStops(train)
        return {
            ...greatNorthernPolicy(state, companyId),
            // P19 treats one city as plain track, which may be a tokened-out one but never the
            // train's only station city (PR-19a).
            ...(payingStopLimit === undefined
                ? {}
                : {
                      payingStopLimit,
                      passesBlockedCity: true,
                      requirePayingStation: true as const
                  })
        }
    },
    extendedDefinition: (state: RouteState & EighteenUSAState, companyId, train, definition) =>
        assignedDefinition(state, companyId, train, definition),
    // A Pullman rides on one train a run, never alone (§12.7).
    attachedDefinition: (_state, train, attachments) =>
        attachments.length === 1 && attachments[0].id === PullmanTrainId
            ? { ...train, id: `${train.id}${PullmanSuffix}` }
            : 'A train draws one Pullman.',
    // A rural junction may begin or end no route (P26).
    endsRoutes: (state, _companyId, center) => !isRuralJunction(state, center.locationId)
}
