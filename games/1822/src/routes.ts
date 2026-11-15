import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    cityIsBlocked,
    getCompany,
    privateOwningCompany,
    routeRevenue,
    usesStationAt,
    type RevenueCenter,
    type RouteResult,
    type RouteRules,
    type TrainDefinition,
    type TrainRunningState
} from '@tabletop/18xx'
import { LnwrId, destinationStationId, major1822 } from './companies.js'
import { FranceLocationId, Map1822 } from './map.js'
import { EnglishChannelLocationId, MailContractPrivateIds } from './privates.js'
import { requireState1822 } from './state.js'
import { TileSet1822 } from './tiles.js'
import {
    ElectricTrainId,
    LocalTrainId,
    PermanentLocalTrainId,
    PullmanTrainId,
    TrainDepot1822,
    revenueStages1822
} from './trains.js'

/** What earned a route's bonus: the run from home to destination (§5.11.5). */
export const DestinationBonusSourceId = 'destination'

const LocalTrainIds: readonly string[] = [LocalTrainId, PermanentLocalTrainId]

function stopNode(state: TrainRunningState, center: RevenueCenter) {
    return new RailwayMapState(Map1822, TileSet1822, state.tileInventory)
        .tile(center.locationId)
        .face.nodes.find((entry) => entry.id === center.nodeId)
}

/** The printed value of a stop at the current phase, before any doubling (§5.13.5). */
function printedValue(state: TrainRunningState, center: RevenueCenter): number {
    const node = stopNode(state, center)
    return node && node.kind !== 'junction'
        ? routeRevenue(node.revenue, revenueStages1822(state.phaseId))
        : 0
}

/** Whether the company holds a station in the English Channel, which is what lets an E train stop at France (§5.9.2). */
function holdsChannelStation(state: TrainRunningState, companyId: string): boolean {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            station.position.locationId === EnglishChannelLocationId
    )
}

/**
 * Whether a major company's destination token is placed and counts as its destination: at once
 * for most, and for the LNWR once London is joined to Manchester (§5.11.1, §5.11.3).
 */
export function destinationReached1822(state: TrainRunningState, companyId: string): boolean {
    if (!major1822(companyId)) return false
    const placed = state.stations.some(
        (station) => station.id === destinationStationId(companyId) && station.status === 'placed'
    )
    return placed && (companyId !== LnwrId || requireState1822(state).lnwrConnected === true)
}

/**
 * A train with a Pullman counts only large stations and passes small ones for their revenue
 * (§5.5.6). The designer bars it from the permanent L (BGG article 34859364); this title bars it
 * from the ordinary L as well.
 */
function withPullman(train: TrainDefinition): TrainDefinition | string {
    if (train.id === ElectricTrainId) return 'A Pullman is never added to an E train (§5.5.6).'
    if (LocalTrainIds.includes(train.id)) return 'A Pullman is never added to an L train.'
    return {
        ...train,
        name: `${train.name}+`,
        distance: { measure: 'cities-and-offboards', maximum: train.distance.maximum }
    }
}

/**
 * Each mail contract pays half the base value of the first and last stations of one train's run,
 * the best such runs taken; an L train carries none (§3.1.12, Table 3).
 */
function mailIncome(state: TrainRunningState, companyId: string, routes: readonly RouteResult[]) {
    const contracts = MailContractPrivateIds.filter(
        (privateId) => privateOwningCompany(state, privateId) === companyId
    ).length
    if (!contracts) return 0
    return routes
        .filter((route) => !LocalTrainIds.includes(route.definitionId) && route.visits.length >= 2)
        .map((route) => {
            const [first, last] = [route.visits[0], route.visits[route.visits.length - 1]]
            return (printedValue(state, first) + printedValue(state, last)) / 2
        })
        .sort((a, b) => b - a)
        .slice(0, contracts)
        .reduce((sum, amount) => sum + amount, 0)
}

export const RouteRules1822: RouteRules = {
    map: Map1822,
    tileSet: TileSet1822,
    depot: TrainDepot1822,
    revenueStage: (state) => revenueStages1822(state.phaseId),
    requiresCity: () => false,
    // The English Channel and France together are one stop, so a run of those two alone is no
    // route; France is the map's one off-board area (§5.4.6, §5.13.1).
    minimumCitiesAndTowns: 2,
    // The English Channel and France are one stop, so a company that cannot run through a full
    // Channel to France cannot run to the Channel either: the designer's ruling on §5.4.6 (BGG
    // article 32242130).
    stopAllowed(state, companyId, center) {
        if (center.locationId !== EnglishChannelLocationId) return true
        const node = stopNode(state, center)
        assertExists(node, 'The English Channel has no stop')
        return !cityIsBlocked(state, companyId, center.locationId, node)
    },
    // An E train stops only at its company's stations, and at France through a station of its
    // own in the English Channel; it passes every other stop (§5.5.8, §5.9.2).
    stopsAt(state, companyId, center, train) {
        if (train.id !== ElectricTrainId) return true
        if (center.locationId === FranceLocationId) return holdsChannelStation(state, companyId)
        return usesStationAt(state, companyId, center.locationId, center.nodeId)
    },
    // Every station an E train counts is doubled (§5.5.8).
    stopRevenue: (_state, _companyId, _center, printed, train) =>
        train.id === ElectricTrainId ? printed * 2 : printed,
    attachedDefinition: (_state, train, attachments) =>
        attachments.length === 1 && attachments[0].id === PullmanTrainId
            ? withPullman(train)
            : 'A train carries one Pullman (§5.5.14).',
    // One train a turn that runs through both the home and the destination station doubles the
    // destination, and an E train doubles that again (§5.11.5, §5.5.9).
    revenuePolicy(train, state, companyId) {
        const major = major1822(companyId)
        if (!major || !destinationReached1822(state, companyId)) return {}
        const bonus =
            printedValue(state, major.destination) * (train.id === ElectricTrainId ? 2 : 1)
        if (!bonus) return {}
        return {
            connectionBonuses: [
                {
                    from: { [major.home.locationId]: 0 },
                    to: { [major.destination.locationId]: bonus },
                    nodeIds: {
                        [major.home.locationId]: major.home.nodeId,
                        [major.destination.locationId]: major.destination.nodeId
                    },
                    oncePerRun: true,
                    sourceId: DestinationBonusSourceId
                }
            ]
        }
    },
    runSubsidy: (state, companyId, routes) =>
        getCompany(state, companyId).kind === 'major' ? mailIncome(state, companyId, routes) : 0
}
