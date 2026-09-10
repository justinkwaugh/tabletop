import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import { cashOwnedBy, controllingOwner, getCompany } from '../finance/finance.js'
import type { CompanyState } from '../company/companyState.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import { StationPosition, type StationReservation, type StationState } from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import { TrackNetwork } from '../construction/trackNetwork.js'

export const StationStep = Type.Object(
    {
        companyId: Type.String(),
        placedStationIds: Type.Array(Type.String(), { uniqueItems: true }),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type StationStep = Type.Static<typeof StationStep>
export type StationPlacementState = CompanyState & MapStateData & { stationStep?: StationStep }
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
export interface StationRules {
    map: RailwayMap
    tileSet: TileSet
    placementCost(state: StationPlacementState, stationId: string): number
    placementLimit(state: StationPlacementState, companyId: string): number
    pendingHomes(state: StationPlacementState): HomeStation[]
    reservationOccupant?(reservation: StationReservation): string | undefined
}
export type StationEvaluation =
    | { details: StationPlacementDetails; reason?: never }
    | { details?: never; reason: string }

export class StationPlacement {
    readonly mapState: RailwayMapState
    constructor(
        private readonly state: StationPlacementState,
        private readonly rules: StationRules
    ) {
        this.mapState = new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
    }
    canAct(playerId: string, companyId: string): boolean {
        const step = this.state.stationStep
        return (
            step?.companyId === companyId &&
            !step.completed &&
            !getCompany(this.state, companyId).closed &&
            controllingOwner(this.state, companyId)?.playerId === playerId
        )
    }
    choices(stationId: string): StationPlacementDetails[] {
        const station = this.state.stations.find((station) => station.id === stationId)
        if (!station || station.status !== 'available') return []
        return this.rules.map.definition.locations.flatMap((location) =>
            this.mapState.tile(location.id).face.nodes.flatMap((node) =>
                this.openSlots(station.companyId, location.id, node.id).flatMap((slot) => {
                    const result = this.evaluate({
                        companyId: station.companyId,
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
        if (station?.status !== 'available' || station.companyId !== companyId)
            return { reason: 'Choose an available station belonging to this company.' }
        if (
            !this.openSlots(companyId, position.locationId, position.nodeId).includes(position.slot)
        )
            return { reason: 'This city slot is occupied, reserved, or unavailable.' }
        const network = new TrackNetwork(this.mapState, this.state, companyId)
        if (!network.reaches(position.locationId, { kind: 'node', nodeId: position.nodeId }))
            return { reason: 'This city is not connected to a company station.' }
        const cost = this.rules.placementCost(this.state, stationId)
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
        if (
            this.state.stations.some(
                (station) =>
                    station.status === 'placed' &&
                    station.companyId === companyId &&
                    station.position.locationId === locationId
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
                        !occupied.some(
                            (station) =>
                                station.companyId === reservation.companyId ||
                                station.id === this.rules.reservationOccupant?.(reservation)
                        )
                )
                .map((reservation) => reservation.companyId)
        ).size
        const free = Array.from({ length: node.stationSlots }, (_, slot) => slot).filter(
            (slot) =>
                !occupied.some(
                    (station) => station.status === 'placed' && station.position.slot === slot
                )
        )
        return free.length > reserved ? free : []
    }
    homePlacements(): StationPlacementDetails[] {
        const planned = {
            ...this.state,
            stations: [...this.state.stations],
            stationReservations: [...this.state.stationReservations]
        }
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
            applyStationPlacement(planned, details)
            placements.push(details)
        }
        return placements
    }
}
export function applyStationPlacement(state: StationState, details: StationPlacementDetails): void {
    const station = state.stations.find((station) => station.id === details.stationId)
    assert(
        station?.status === 'available' && station.companyId === details.companyId,
        'Station placement requires an available company station'
    )
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
                reservation.companyId === details.companyId &&
                reservation.locationId === details.position.locationId &&
                reservation.nodeId === details.position.nodeId
            )
    )
}
