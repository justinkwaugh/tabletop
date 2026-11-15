import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    abandonOperatingTurn,
    applyStationPlacement,
    cheapestAffordableTrain,
    getCompany,
    homeStationId,
    nationaliseCompany,
    nextOperatingCompany,
    routeRevenue,
    StationPlacement,
    treasuryPoolId,
    type NationalisationRules,
    type NationalisedStation,
    type Nationalisation,
    type PlacedStation,
    type ReceivershipRules,
    type Station,
    type StationState,
    type TrainPurchaseState,
    type MapStateData,
    type TrainRules
} from '@tabletop/18xx'
import { MajorShareCount, RsrId, RsrOutsideStationLimit } from './companies.js'
import { LoanRules1861 } from './loans.js'
import { Map1861, MoscowLocationId, StPetersburgLocationId } from './map.js'
import { requireState1861, type HydratedState1861 } from './state.js'
import { StationRules1861 } from './stations.js'
import { LeftOrDownMove, Market1861 } from './stockMarket.js'
import { TileSet1861 } from './tiles.js'
import { RsrOperatingPhaseIds, TrainDepot1861, revenueStages1861 } from './trains.js'

/** The RSR's stations kept for St. Petersburg and Moscow; six more go anywhere (§7.4, §11). */
const ReservedRsrCities = [StPetersburgLocationId, MoscowLocationId]

function rsrStations(state: StationState, status: Station['status']): Station[] {
    return state.stations.filter(
        (station) => station.companyId === RsrId && station.status === status
    )
}

function rsrPlacedIn(state: StationState, locationId: string): boolean {
    return state.stations.some(
        (station) =>
            station.companyId === RsrId &&
            station.status === 'placed' &&
            station.position.locationId === locationId
    )
}

/** The RSR's second station, kept for Moscow. */
export const RsrMoscowStationId = `${RsrId}:station:1`

/** The RSR station kept for a city: its home for St. Petersburg, its second for Moscow. */
function reservedStationId(locationId: string): string {
    return locationId === StPetersburgLocationId ? homeStationId(RsrId) : RsrMoscowStationId
}

function generalStationIds(state: StationState): string[] {
    return rsrStations(state, 'available')
        .map((station) => station.id)
        .filter((id) => !ReservedRsrCities.some((city) => reservedStationId(city) === id))
}

function placedOutsideReservedCities(state: StationState): number {
    return rsrStations(state, 'placed').filter(
        (station) =>
            station.status === 'placed' && !ReservedRsrCities.includes(station.position.locationId)
    ).length
}

function cityValue(state: HydratedState1861, station: PlacedStation): number {
    const mapState = new RailwayMapState(Map1861, TileSet1861, state.tileInventory)
    const node = mapState
        .tile(station.position.locationId)
        .face.nodes.find((entry) => entry.id === station.position.nodeId)
    return node && node.kind !== 'junction'
        ? routeRevenue(node.revenue, revenueStages1861(state.phaseId))
        : 0
}

/** Orders location ids the same in every locale. */
const compareCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The RSR takes over the nationalised company's stations, the most valuable cities first (ties
 * by location), one to a hex and no more than six outside St. Petersburg and Moscow (§11).
 */
function nationalStations(state: HydratedState1861, companyId: string): NationalisedStation[] {
    const placed = state.stations
        .filter(
            (station): station is PlacedStation =>
                station.companyId === companyId && station.status === 'placed'
        )
        .toSorted(
            (a, b) =>
                cityValue(state, b) - cityValue(state, a) ||
                compareCodeUnits(a.position.locationId, b.position.locationId)
        )
    const taken: NationalisedStation[] = []
    const hexes = new Set<string>()
    const general = generalStationIds(state)
    let outside = placedOutsideReservedCities(state)
    for (const station of placed) {
        const { locationId } = station.position
        if (rsrPlacedIn(state, locationId) || hexes.has(locationId)) continue
        const reserved = ReservedRsrCities.includes(locationId)
        const nationalStationId = reserved
            ? reservedStationId(locationId)
            : outside < RsrOutsideStationLimit
              ? general.shift()
              : undefined
        if (
            !nationalStationId ||
            !state.stations.some(
                (entry) => entry.id === nationalStationId && entry.status === 'available'
            )
        )
            continue
        if (!reserved) outside++
        hexes.add(locationId)
        taken.push({ stationId: station.id, nationalStationId })
    }
    return taken
}

export const NationalisationRules1861: NationalisationRules = {
    market: Market1861,
    loans: LoanRules1861,
    // A step left a loan still owed after repaying what it can (§11).
    stepsPerLoan: 1,
    direction: LeftOrDownMove,
    // With no price floor, each space it cannot fall below R35 takes R5 off a share (GTG §14).
    payoutBelowFloor: (state, price, missed) =>
        requireState1861(state).variants.noPriceFloor ? Math.max(0, price - 5 * missed) : price,
    nationalId: RsrId,
    trainDestination: 'market',
    nationalStations: (state, companyId) => nationalStations(requireState1861(state), companyId),
    // A nationalised public company can be started again; a minor closes (§7.3, §11).
    restart: (state, companyId) =>
        getCompany(state, companyId).kind === 'major'
            ? {
                  poolId: treasuryPoolId(companyId),
                  shareCount: MajorShareCount,
                  keepsAllStations: true
              }
            : undefined
}

/**
 * Nationalises the company: its shareholders are paid, the RSR takes its assets and stations,
 * and it leaves the operating round, its turn ending if it is operating (§11). Nationalising
 * several at once names the company operating before the first, as ending its turn makes the
 * next company look as if it were operating.
 */
export function nationalise1861(
    state: HydratedState1861,
    companyId: string,
    operatingCompanyId = nextOperatingCompany(state)
): Nationalisation {
    const operating = operatingCompanyId === companyId
    const details = nationaliseCompany(state, NationalisationRules1861, companyId)
    if (state.phaseChange)
        state.phaseChange.discardCompanyIds = state.phaseChange.discardCompanyIds.filter(
            (id) => id !== companyId
        )
    releaseRsrReservation(state)
    const set = state.operatingSet
    if (operating) abandonOperatingTurn(state, companyId)
    else if (set && !set.completed)
        set.companyOrder = set.companyOrder.filter(
            (id) => id !== companyId || set.completedCompanyIds.includes(id)
        )
    return details
}

/** Once the RSR has a station in St. Petersburg, the space kept for it is free (§7.4). */
function releaseRsrReservation(state: HydratedState1861): void {
    if (!rsrPlacedIn(state, StPetersburgLocationId)) return
    state.stationReservations = state.stationReservations.filter(
        (reservation) => reservation.companyId !== RsrId
    )
}

/** Whether the RSR operates in this phase: from the first 4-train until the first 8-train (§7.4). */
export function rsrOperates(state: { phaseId: string }): boolean {
    return (
        RsrOperatingPhaseIds.includes(state.phaseId) &&
        !requireState1861(state).variants.trainExports
    )
}

/**
 * The RSR places its St. Petersburg station as it first operates, in the space kept for it,
 * unless it has one there already (§7.4, §14.3).
 */
export function placeRsrHome(state: HydratedState1861): boolean {
    return placeRsrStation(state, StPetersburgLocationId, homeStationId(RsrId))
}

/** Moscow's grey tile takes an RSR station at once, unless it has one there (§7.4). */
export function placeRsrMoscowStation(state: HydratedState1861): boolean {
    return placeRsrStation(state, MoscowLocationId, RsrMoscowStationId)
}

/**
 * Places an RSR station kept for a city, unless the RSR has one there: in the space reserved for
 * it while one is, otherwise the first open space of the city's tile.
 */
function placeRsrStation(state: HydratedState1861, locationId: string, stationId: string): boolean {
    if (rsrPlacedIn(state, locationId)) return false
    if (
        !state.stations.some(
            (station) => station.id === stationId && station.status === 'available'
        )
    )
        return false
    const placement = new StationPlacement(state, StationRules1861)
    const reserved = state.stationReservations.find(
        (reservation) => reservation.companyId === RsrId && reservation.locationId === locationId
    )?.nodeId
    const mapState = new RailwayMapState(Map1861, TileSet1861, state.tileInventory)
    const nodeIds = reserved
        ? [reserved]
        : mapState
              .tile(locationId)
              .face.nodes.filter((node) => node.kind === 'city')
              .map((node) => node.id)
    for (const nodeId of nodeIds) {
        const [slot] = placement.openSlots(RsrId, locationId, nodeId)
        if (slot === undefined) continue
        applyStationPlacement(state, {
            companyId: RsrId,
            stationId,
            position: { locationId, nodeId, slot },
            cost: 0
        })
        releaseRsrReservation(state)
        return true
    }
    return false
}

/**
 * The RSR's train when trainless: the cheapest from the bank, borrowing for it; otherwise the
 * next new train while it can pay for one from its treasury (§10.10, GTG §8.13).
 */
function rsrTrainPurchase(
    state: TrainPurchaseState & MapStateData,
    companyId: string,
    rules: TrainRules
) {
    const trainless = !state.trainInventory.trains.some(
        (train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === companyId
    )
    if (trainless) return cheapestAffordableTrain(state, companyId, rules)
    // Having bought the first 8-train, it goes on buying 8-trains in that turn while it can pay,
    // as it buys all it can afford (GTG §8.13); it does not operate again (§7.4).
    const definitionId = TrainDepot1861.nextDefinitionId(state.trainInventory)
    if (!definitionId) return undefined
    const train = TrainDepot1861.nextTrain(state.trainInventory, definitionId)
    if (!train) return undefined
    const price = TrainDepot1861.trainDefinition(definitionId).price
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )?.amount
    if (typeof cash !== 'number' || cash < price) return undefined
    return { companyId, trainId: train.id, definitionId, expectedPrice: price }
}

/**
 * The RSR is run by the system: it lays no track, keeps all its earnings and buys trains; the
 * holder of the priority deal runs its trains for the best earnings (§7.4, §10).
 */
export const ReceivershipRules1861: ReceivershipRules = {
    operators: (state) => {
        const [priority] = state.turnManager.turnOrder
        assertExists(priority, 'The priority deal is held')
        return [priority]
    },
    earningsChoice: () => 'withhold',
    trainPurchase: rsrTrainPurchase
}
