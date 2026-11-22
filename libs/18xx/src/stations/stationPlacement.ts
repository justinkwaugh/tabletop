import { stateWith } from '../game/stateWith.js'
import type { RevenueCenter } from '../routes/route.js'
import { actsFor } from '../finance/receivership.js'
import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { cashOwnedBy, getCompany } from '../finance/finance.js'
import type { CompanyState } from '../company/companyState.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import {
    StationPosition,
    filledStationSpaces,
    stationPlacer,
    type NeutralStations,
    type StationReservation,
    type StationState
} from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import type { TileNode } from '../tiles/tile.js'
import { TrackNetwork } from '../construction/trackNetwork.js'
import type { OperatingSet } from '../operating/operatingSet.js'
import type { GameEnding } from '../ending/gameEnding.js'
import type { AccessRightState } from '../rights/accessRights.js'

export const StationStep = Type.Object(
    {
        companyId: Type.String(),
        placedStationIds: Type.Array(Type.String(), { uniqueItems: true }),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type StationStep = Type.Static<typeof StationStep>
export type StationPlacementState = CompanyState &
    MapStateData & {
        stationStep?: StationStep
        operatingSet?: OperatingSet
        gameEnding?: GameEnding
    } & AccessRightState
export const StationRequest = Type.Object(
    {
        companyId: Type.String(),
        stationId: Type.String(),
        position: StationPosition
    },
    { additionalProperties: false }
)
export type StationRequest = Type.Static<typeof StationRequest>
export const StationPlacementDetails = Type.Object(
    {
        ...StationRequest.properties,
        cost: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type StationPlacementDetails = Type.Static<typeof StationPlacementDetails>
export type HomeStation = { stationId: string; locationId: string; nodeId: string }
export type HomePosition = Pick<StationPosition, 'locationId' | 'nodeId'>
export type HomeStationChoice = {
    companyId: string
    stationId: string
    positions: readonly HomePosition[]
}
export type OperatingStationState = StationPlacementState & { operatingSet?: OperatingSet }
export type StationPlacementContext = StationRequest & { connected: boolean }
export interface StationRules {
    map: RailwayMap
    tileSet: TileSet
    /** Without a destination context, returns the token's base price for presentation. */
    placementCost(
        state: StationPlacementState,
        stationId: string,
        context?: StationPlacementContext
    ): number
    allowsDisconnected?(state: StationPlacementState, request: StationRequest): boolean
    placementLimit(state: StationPlacementState, companyId: string): number
    /** Whether the company's network may continue through a revenue center, as its routes may. */
    stopAllowed?(state: StationPlacementState, companyId: string, center: RevenueCenter): boolean
    /**
     * Whether the company's network may continue through this city though other companies'
     * stations fill it, as it may for track, such as 18USA's Company Town (P27).
     */
    passesStations?(state: StationPlacementState, companyId: string, center: RevenueCenter): boolean
    /** Whether a title placement, such as a private's token, keeps the station step open. */
    holdsStationStep?(state: StationPlacementState, companyId: string): boolean
    pendingHomes(state: OperatingStationState): HomeStation[]
    /** Titles whose presidents choose a home city return the next operating company's choice. */
    homeChoice?(state: OperatingStationState): HomeStationChoice | undefined
    reservationOccupant?(reservation: StationReservation): string | undefined
    /**
     * Whether the hex's cities are places of their own, each open to a station of the same
     * company, as London's six stations are (1822 §5.4.2, §5.12.6).
     */
    citiesApart?(locationId: string): boolean
    /**
     * Whether the space beside a full city, which otherwise only a title's own tokens take, is
     * open to any company's station, as the London roundel space the Metropolitan Railway leaves
     * (1822 §5.10.4).
     */
    opensBesideCity?(state: StationPlacementState, locationId: string, nodeId: string): boolean
    /**
     * Whether a city takes no station yet, as 1867's city spaces printed green take none before
     * phase 3 (GTG §7.2.1).
     */
    cityClosed?(state: StationPlacementState, locationId: string, nodeId: string): boolean
}
export type StationEvaluation =
    { details: StationPlacementDetails; reason?: never } | { details?: never; reason: string }

export class StationPlacement {
    readonly mapState: RailwayMapState
    constructor(
        private readonly state: StationPlacementState,
        private readonly rules: StationRules
    ) {
        this.mapState = new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
    }
    canAct(playerId: string | undefined, companyId: string): boolean {
        const step = this.state.stationStep
        return (
            step?.companyId === companyId &&
            !step.completed &&
            !getCompany(this.state, companyId).closed &&
            actsFor(this.state, playerId, companyId)
        )
    }
    choices(stationId: string): StationPlacementDetails[] {
        const station = this.state.stations.find((station) => station.id === stationId)
        if (!station || station.status !== 'available') return []
        const placer = stationPlacer(this.rules.map, station)
        if (!placer) return []
        return this.rules.map.definition.locations.flatMap((location) =>
            this.mapState.tile(location.id).face.nodes.flatMap((node) =>
                this.openSlots(station.companyId, location.id, node.id).flatMap((slot) => {
                    const result = this.evaluate({
                        companyId: placer,
                        stationId,
                        position: { locationId: location.id, nodeId: node.id, slot }
                    })
                    return result.details ? [result.details] : []
                })
            )
        )
    }
    evaluate(request: StationRequest): StationEvaluation {
        const { companyId, stationId, position } = request
        const step = this.state.stationStep
        if (!step || step.completed || step.companyId !== companyId)
            return { reason: 'This company is not placing stations.' }
        if (getCompany(this.state, companyId).closed)
            return { reason: 'A closed company cannot place a station.' }
        if (step.placedStationIds.length >= this.rules.placementLimit(this.state, companyId))
            return { reason: 'No station placement remains this turn.' }
        const station = this.state.stations.find((entry) => entry.id === stationId)
        if (station?.status !== 'available' || stationPlacer(this.rules.map, station) !== companyId)
            return { reason: 'Choose an available station belonging to this company.' }
        if (
            !this.openSlots(station.companyId, position.locationId, position.nodeId).includes(
                position.slot
            )
        )
            return { reason: 'This city slot is occupied, reserved, or unavailable.' }
        const network = new TrackNetwork(
            this.mapState,
            stateWith(this.state, {
                stationAccess: this.state.stationAccess?.filter(
                    (access) => access.placesStations !== false
                )
            }),
            companyId,
            undefined,
            undefined,
            (locationId, nodeId) =>
                this.rules.stopAllowed?.(this.state, companyId, { locationId, nodeId }) === false,
            (locationId, nodeId) =>
                this.rules.passesStations?.(this.state, companyId, { locationId, nodeId }) ?? false
        )
        const connected = network.reaches(position.locationId, {
            kind: 'node',
            nodeId: position.nodeId
        })
        if (!connected && !this.rules.allowsDisconnected?.(this.state, request))
            return { reason: 'This city is not connected to a company station.' }
        const cost = this.rules.placementCost(this.state, stationId, { ...request, connected })
        assert(Number.isInteger(cost) && cost >= 0, 'Invalid station cost')
        const cash = cashOwnedBy(this.state, { kind: 'company', companyId })
        if (cash === undefined || (cash !== 'unlimited' && cash < cost))
            return { reason: 'The company cannot afford this station.' }
        return { details: { companyId, stationId, position: { ...position }, cost } }
    }
    openSlots(companyId: string, locationId: string, nodeId: string): number[] {
        if (!this.rules.map.definition.locations.some((location) => location.id === locationId))
            return []
        const node = this.mapState.tile(locationId).face.nodes.find((node) => node.id === nodeId)
        if (node?.kind !== 'city') return []
        if (this.rules.cityClosed?.(this.state, locationId, nodeId)) return []
        const apart = this.rules.citiesApart?.(locationId) ?? false
        if (
            this.state.stations.some(
                (station) =>
                    station.status === 'placed' &&
                    station.companyId === companyId &&
                    station.position.locationId === locationId &&
                    (!apart || station.position.nodeId === nodeId)
            ) ||
            (this.state.stationAccess ?? []).some(
                (access) => access.companyId === companyId && access.locationId === locationId
            )
        )
            return []
        const occupied = this.state.stations.filter(
            (station) =>
                station.status === 'placed' &&
                station.position.locationId === locationId &&
                station.position.nodeId === nodeId
        )
        const reserved = new Set(
            this.state.stationReservations
                .filter(
                    (reservation) =>
                        reservation.locationId === locationId &&
                        reservation.nodeId === nodeId &&
                        reservation.companyId !== companyId &&
                        !reservationFulfilled(this.state, reservation, this.rules)
                )
                .map((reservation) => reservation.companyId)
        ).size
        const isFree = (slot: number) =>
            !occupied.some(
                (station) => station.status === 'placed' && station.position.slot === slot
            )
        const free = Array.from({ length: node.stationSlots }, (_, slot) => slot).filter(isFree)
        const offered = [
            ...(free.length > reserved ? free : []),
            ...this.freeBesideSlots(locationId, node)
        ]
        if (!offered.length) return []
        return this.hexClaims(companyId, locationId) < this.hexSpaces(companyId, locationId)
            ? offered
            : []
    }
    private freeBesideSlots(
        locationId: string,
        node: Extract<TileNode, { kind: 'city' }>
    ): readonly number[] {
        const beside = node.stationSlots
        const taken = this.state.stations.some(
            (station) =>
                station.status === 'placed' &&
                station.position.locationId === locationId &&
                station.position.nodeId === node.id &&
                station.position.slot === beside
        )
        return !taken && this.rules.opensBesideCity?.(this.state, locationId, node.id)
            ? [beside]
            : []
    }
    /**
     * Claims on any city of a hex that a placement must leave room for: other companies'
     * unanswered hex reservations, and stations set aside there for their owners to place again.
     */
    private hexClaims(companyId: string, locationId: string): number {
        const reservations = (this.state.hexReservations ?? []).filter(
            (reservation) =>
                reservation.locationId === locationId &&
                reservation.companyId !== companyId &&
                !hexReservationFulfilled(this.state, reservation)
        ).length
        const displaced = this.state.stations.filter(
            (station) => station.status === 'displaced' && station.locationId === locationId
        ).length
        return reservations + displaced
    }
    /** The free station spaces of a hex, less those its cities reserve for other companies. */
    private hexSpaces(companyId: string, locationId: string): number {
        return this.mapState.tile(locationId).face.nodes.reduce((total, node) => {
            if (node.kind !== 'city') return total
            const placed = filledStationSpaces(this.state, locationId, node)
            const reserved = new Set(
                this.state.stationReservations
                    .filter(
                        (reservation) =>
                            reservation.locationId === locationId &&
                            reservation.nodeId === node.id &&
                            reservation.companyId !== companyId &&
                            !reservationFulfilled(this.state, reservation, this.rules)
                    )
                    .map((reservation) => reservation.companyId)
            ).size
            return (
                total +
                Math.max(0, node.stationSlots - placed - reserved) +
                this.freeBesideSlots(locationId, node).length
            )
        }, 0)
    }
    homePlacements(): StationPlacementDetails[] {
        const planned = stateWith(this.state, {
            stations: [...this.state.stations],
            stationReservations: [...this.state.stationReservations]
        })
        const placements: StationPlacementDetails[] = []
        for (const home of this.rules.pendingHomes(this.state)) {
            const station = planned.stations.find((station) => station.id === home.stationId)
            assert(station?.status === 'available', 'Home requires an available station')
            const slot = new StationPlacement(planned, this.rules).openSlots(
                station.companyId,
                home.locationId,
                home.nodeId
            )[0]
            assert(slot !== undefined, 'Reserved home requires an available city slot')
            const details = {
                companyId: station.companyId,
                stationId: station.id,
                position: { locationId: home.locationId, nodeId: home.nodeId, slot },
                cost: 0
            }
            applyStationPlacement(planned, details, this.rules.map)
            releaseHomeReservations(planned, station.companyId, [home.locationId])
            placements.push(details)
        }
        return placements
    }
}
/**
 * Whether a station placed in a reservation's city already answers it: its company's, or the
 * station the rules name as occupying it.
 */
export function reservationFulfilled(
    state: StationState,
    reservation: StationReservation,
    rules: Pick<StationRules, 'reservationOccupant'>
): boolean {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.position.locationId === reservation.locationId &&
            station.position.nodeId === reservation.nodeId &&
            (station.companyId === reservation.companyId ||
                station.id === rules.reservationOccupant?.(reservation))
    )
}

/** Whether the company holding a hex reservation has a station on the hex. */
export function hexReservationFulfilled(
    state: StationState,
    reservation: { companyId: string; locationId: string }
): boolean {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === reservation.companyId &&
            station.position.locationId === reservation.locationId
    )
}

// A placed home fulfils its company's reservations on the home hexes.
export function releaseHomeReservations(
    state: StationState,
    companyId: string,
    locationIds: readonly string[]
): void {
    state.stationReservations = state.stationReservations.filter(
        (reservation) =>
            reservation.companyId !== companyId || !locationIds.includes(reservation.locationId)
    )
    if (state.hexReservations)
        state.hexReservations = state.hexReservations.filter(
            (reservation) =>
                reservation.companyId !== companyId || !locationIds.includes(reservation.locationId)
        )
}
/** Places a station; ``map`` lists the title's neutral stations, which it may be one of. */
export function applyStationPlacement(
    state: StationState,
    details: StationPlacementDetails,
    map: NeutralStations
): void {
    const station = state.stations.find((station) => station.id === details.stationId)
    assert(
        station?.status === 'available' && stationPlacer(map, station) === details.companyId,
        'Station placement requires an available company station'
    )
    const ownerId = station.companyId
    state.stations = state.stations.map((station) =>
        station.id === details.stationId
            ? {
                  id: station.id,
                  companyId: station.companyId,
                  status: 'placed',
                  position: { ...details.position }
              }
            : station
    )
    state.stationReservations = state.stationReservations.filter(
        (reservation) =>
            !(
                reservation.companyId === ownerId &&
                reservation.locationId === details.position.locationId &&
                reservation.nodeId === details.position.nodeId
            )
    )
    if (state.hexReservations)
        state.hexReservations = state.hexReservations.filter(
            (reservation) =>
                !(
                    reservation.companyId === ownerId &&
                    reservation.locationId === details.position.locationId
                )
        )
}

export function validateStationStep(state: {
    machineState: string
    stationStep?: StationStep
    trackStep?: { companyId: string }
}): void {
    if (state.machineState !== 'PlacingStation') return
    assert(
        state.stationStep?.companyId === state.trackStep?.companyId && state.stationStep,
        'Station step requires the operating company'
    )
    assert(!state.stationStep.completed, 'A completed station step has left station placement')
}
