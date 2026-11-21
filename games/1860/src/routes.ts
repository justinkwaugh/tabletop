import {
    finiteCashOwnedBy,
    homeStationId,
    isHalt,
    trainsOwnedBy,
    type RevenueCenter,
    type RouteRules,
    type Train,
    type TrainDefinition,
    type TrainRunningState
} from '@tabletop/18xx'
import { Map1860 } from './map.js'
import { requireState1860 } from './state.js'
import { TileSet1860, mapState1860 } from './tiles.js'
import { Phases1860, TrainDepot1860, largeStationAllowance } from './trains.js'

/** A halt pays its company £10 for each train calling there (Track Tiles; Running Trains). */
export const HaltSubsidy = 10
/** A leased train earns £40, and £20 for each stop it calls at (Insolvency). */
export const LeaseBase = 40
export const LeasePerStop = 20

/** The bank's smallest train still for sale, the one an insolvent company leases. */
export function smallestBankTrain(state: TrainRunningState): Train | undefined {
    const trains = state.trainInventory.trains.filter(
        (train) => train.status === 'depot' || train.status === 'market'
    )
    const order = TrainDepot1860.definition.supply.map((entry) => entry.definitionId)
    return trains.sort((a, b) => order.indexOf(a.definitionId) - order.indexOf(b.definitionId))[0]
}

/**
 * The train an insolvent company runs: the bank's smallest, leased, when it owns none and cannot
 * pay for that train (Insolvency).
 */
export function leasedTrain(state: TrainRunningState, companyId: string): Train | undefined {
    const title = requireState1860(state)
    if (!title.insolventIds.includes(companyId)) return undefined
    if (trainsOwnedBy(title, { kind: 'company', companyId }).length) return undefined
    const train = smallestBankTrain(state)
    if (!train) return undefined
    const price = TrainDepot1860.trainDefinition(train.definitionId).price
    return finiteCashOwnedBy(state, { kind: 'company', companyId }) < price ? train : undefined
}

function leases(state: TrainRunningState, companyId: string): boolean {
    return leasedTrain(state, companyId) !== undefined
}

/** The tile node a run's stop stands on. */
function stopNode(state: TrainRunningState, center: RevenueCenter) {
    return mapState1860(state)
        .tile(center.locationId)
        .face.nodes.find((entry) => entry.id === center.nodeId)
}

/** Once a stock round has followed the Southern's formation, halts count in no run (SO-3). */
function haltsUncounted(state: TrainRunningState): boolean {
    return !!requireState1860(state).southernStockRound
}

/** Whether the run counts only its large-station allowance: leased, or after nationalisation. */
function largeStationsOnly(state: TrainRunningState, companyId: string): boolean {
    return leases(state, companyId) || !!requireState1860(state).nationalisation
}

export const RouteRules1860: RouteRules = {
    map: Map1860,
    tileSet: TileSet1860,
    depot: TrainDepot1860,
    // Ryde Pier pays more as green and russet tiles arrive (The Map).
    revenueStage: (state) => Phases1860.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    // Small stations and halts may be passed by; the first edition's option keeps small stations
    // (Running Trains; Playing the Original Game).
    stopOptional(state, _companyId, center) {
        const node = stopNode(state, center)
        if (node?.kind !== 'town') return false
        return isHalt(node) || !requireState1860(state).options.noSkippingTowns
    },
    // Halts pay £10 to the treasury, but not to a leased train under the standard insolvency
    // rule, and not once a stock round has followed the Southern's formation (Formation of the
    // Southern Railway).
    stopSubsidy(state, companyId, center) {
        if (haltsUncounted(state) || leases(state, companyId)) return 0
        const node = stopNode(state, center)
        return node && isHalt(node) ? HaltSubsidy : 0
    },
    // A leased train earns £20 a stop, halts included until they stop counting, and £40 more,
    // counted at the home its one run must include; under the simplified rule the home counts
    // the most the train could earn and the other stops nothing (Insolvency; Simplified
    // Insolvency Revenue; IN-8).
    stopRevenue(state, companyId, center, printed) {
        const train = leasedTrain(state, companyId)
        if (!train) return printed
        const node = stopNode(state, center)
        if (node && isHalt(node) && haltsUncounted(state)) return 0
        const home = state.stations.find((station) => station.id === homeStationId(companyId))
        const atHome =
            home?.status === 'placed' &&
            home.position.locationId === center.locationId &&
            home.position.nodeId === center.nodeId
        if (requireState1860(state).options.simplifiedInsolvency)
            return atHome ? LeaseBase + LeasePerStop * largeStationAllowance(train.definitionId) : 0
        return LeasePerStop + (atHome ? LeaseBase : 0)
    },
    extendedDefinition(state, companyId, train, definition): TrainDefinition {
        if (!largeStationsOnly(state, companyId)) return definition
        return {
            ...definition,
            distance: {
                measure: 'revenue-centers',
                maximum: largeStationAllowance(train.definitionId)
            }
        }
    },
    leasedTrain,
    // A bankrupt company's flipped bases block no runs (Bankrupt Companies).
    passesStations(state, _companyId, center) {
        const title = requireState1860(state)
        return state.stations.some(
            (station) =>
                station.status === 'placed' &&
                station.position.locationId === center.locationId &&
                station.position.nodeId === center.nodeId &&
                title.bankruptIds.includes(station.companyId)
        )
    },
    // One train a run may pass one tokened-out station (Running Trains).
    blockedCityPasses: () => 1,
    forbidsHexReentry: (state) => !requireState1860(state).options.reenterHexes,
    // One run includes the home; each other meets one before it at a station or halt.
    fleet: { connectivity: { at: ['city', 'town', 'offboard'], root: 'home' } }
}
