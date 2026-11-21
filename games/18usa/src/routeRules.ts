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
    RichOreMarker
} from './resourceMarkers.js'
import { ExpressFreightId, GreatNorthernId, companyHolding } from './privateHolders.js'
import { redAreaOf } from './redAreas.js'
import { subsidy } from './subsidyRules.js'
import { assignedDefinition, switcherPayingStops } from './trainAssignments.js'

type RouteState = TrainRunningState & Pick<EighteenUSAState, 'cityBonuses'>

const BridgeBonus = 10
const RaisedPhaseId = '5'
const PullmanSuffix = `+${PullmanTrainId}`

const ResourceKinds = [CoalMarker, OilMarker, OreMarker, RichOreMarker]

/** Whether a coal, oil or ore token lies in the hex, which a train passes only once (§13). */
function holdsResource(state: TrainRunningState, locationId: string): boolean {
    return locationMarkers(state, { locationId }).some((marker) =>
        ResourceKinds.includes(marker.kind)
    )
}

/** Each resource token pays every route passing its hex once: oil $20 from phase 5 (§13). */
function resourceBonus(state: TrainRunningState, locationId: string): number {
    const raised = EighteenUSAPhases.isAtLeast(state.phaseId, RaisedPhaseId)
    return locationMarkers(state, { locationId }).reduce((sum, marker) => {
        if (marker.kind === CoalMarker || marker.kind === OreMarker) return sum + 10
        if (marker.kind === RichOreMarker) return sum + 20
        if (marker.kind === OilMarker) return sum + (raised ? 20 : 10)
        return sum
    }, 0)
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
    const placement = EighteenUSATileSet.parseInventory(state.tileInventory).placements[locationId]
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
            ? BridgeBonus
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
            // P19 treats one city as plain track, which may be a tokened-out one (PR-19a).
            ...(payingStopLimit === undefined ? {} : { payingStopLimit, passesBlockedCity: true })
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
