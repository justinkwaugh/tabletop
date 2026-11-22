import * as Type from 'typebox'
import type { TileNode } from '../tiles/tile.js'
import { assert } from '@tabletop/common'

const Id = Type.String({ minLength: 1 })
export const CityReservation = Type.Object(
    { companyId: Id, nodeId: Id },
    { additionalProperties: false }
)
export type CityReservation = Type.Static<typeof CityReservation>
export const StationReservation = Type.Object(
    {
        ...CityReservation.properties,
        locationId: Id
    },
    { additionalProperties: false }
)
export type StationReservation = Type.Static<typeof StationReservation>

export function stationReservation(
    companyId: string,
    city: Pick<StationReservation, 'locationId' | 'nodeId'>
): StationReservation {
    return { companyId, locationId: city.locationId, nodeId: city.nodeId }
}
export const StationPosition = Type.Object(
    {
        locationId: Id,
        nodeId: Id,
        slot: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type StationPosition = Type.Static<typeof StationPosition>

export function sameStationPosition(a: StationPosition, b: StationPosition): boolean {
    return a.locationId === b.locationId && a.nodeId === b.nodeId && a.slot === b.slot
}
const Identity = { id: Id, companyId: Id }
export const PlacedStation = Type.Object(
    { ...Identity, status: Type.Literal('placed'), position: StationPosition },
    { additionalProperties: false }
)
export type PlacedStation = Type.Static<typeof PlacedStation>
/**
 * A station an upgrade set aside, as 1894's split cities do, until its owner places it again
 * on the same hex.
 */
export const DisplacedStation = Type.Object(
    { ...Identity, status: Type.Literal('displaced'), locationId: Id },
    { additionalProperties: false }
)
export type DisplacedStation = Type.Static<typeof DisplacedStation>
export const Station = Type.Union([
    Type.Object(
        { ...Identity, status: Type.Literal('available') },
        { additionalProperties: false }
    ),
    PlacedStation,
    Type.Object({ ...Identity, status: Type.Literal('removed') }, { additionalProperties: false }),
    DisplacedStation
])
export type Station = Type.Static<typeof Station>
/** A company's claim to a station space somewhere on a hex, such as a home on a split city. */
export const HexReservation = Type.Object(
    { companyId: Id, locationId: Id },
    { additionalProperties: false }
)
export type HexReservation = Type.Static<typeof HexReservation>
/**
 * A place a company uses as one of its stations to build and run from without a piece of its
 * own there: a station shared with another company, or a private's offboard.
 */
export const StationAccess = Type.Object(
    {
        companyId: Id,
        locationId: Id,
        nodeId: Id,
        sourceId: Id,
        /** The company may not trace new stations from it, as from a private's offboard. */
        placesStations: Type.Optional(Type.Literal(false))
    },
    { additionalProperties: false }
)
export type StationAccess = Type.Static<typeof StationAccess>
/**
 * A neutral station fills a city space but blocks no company's route through the city: 1882's
 * neutral stations, which keep a city open to run through (§4, §11.1). Its company is the one
 * that runs from it, 1882's Canadian National. `heldBy` names the company whose charter holds it
 * and that places it; one without a holder waits in the supply for a title's power to place it.
 */
export const NeutralStation = Type.Object(
    { stationId: Id, heldBy: Type.Optional(Id) },
    { additionalProperties: false }
)
export type NeutralStation = Type.Static<typeof NeutralStation>
/** A title's neutral stations, which its map lists. */
export type NeutralStations = { readonly neutralStations: readonly NeutralStation[] }
/** For a placement that is only ever a company's own station, never a neutral one. */
export const CompanyStationsOnly: NeutralStations = { neutralStations: [] }
export const StationFields = {
    stations: Type.Array(Station),
    stationReservations: Type.Array(StationReservation),
    hexReservations: Type.Optional(Type.Array(HexReservation)),
    stationAccess: Type.Optional(Type.Array(StationAccess)),
    // Stored games from before this stopped being recorded may hold it; never read.
    neutralStations: Type.Optional(Type.Unsafe<never>(Type.Array(NeutralStation)))
}
export type StationState = Type.Static<Type.TObject<typeof StationFields>>

export function neutralStation(
    neutral: NeutralStations,
    stationId: string
): NeutralStation | undefined {
    return neutral.neutralStations.find((entry) => entry.stationId === stationId)
}

/**
 * The company that places a station in its station step: its own company, or for a neutral
 * station the company holding it, if any.
 */
export function stationPlacer(
    neutral: NeutralStations,
    station: Pick<Station, 'id' | 'companyId'>
): string | undefined {
    const definition = neutralStation(neutral, station.id)
    return definition ? definition.heldBy : station.companyId
}

/** The stations a company may place: its own still available, and the neutral ones it holds. */
export function placeableStations(
    state: Pick<StationState, 'stations'>,
    neutral: NeutralStations,
    companyId: string
): Station[] {
    return state.stations.filter(
        (station) => station.status === 'available' && stationPlacer(neutral, station) === companyId
    )
}

/** A waiting token's place among its company's tokens still waiting to be placed. */
export function waitingStationIndex(
    stations: readonly Station[],
    station: Pick<Station, 'id' | 'companyId'>
): number {
    const index = stations
        .filter((entry) => entry.companyId === station.companyId && entry.status === 'available')
        .findIndex((entry) => entry.id === station.id)
    assert(index >= 0, `Station ${station.id} is waiting to be placed`)
    return index
}

/** Whether a city holds a neutral station, which keeps it open to every route (1882 §11.1). */
export function cityHasNeutralStation(
    state: Pick<StationState, 'stations'>,
    neutral: NeutralStations,
    locationId: string,
    nodeId: string
): boolean {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.position.locationId === locationId &&
            station.position.nodeId === nodeId &&
            !!neutralStation(neutral, station.id)
    )
}

/** Where a company builds and runs from: its placed stations and the places it has access to. */
export function companyStationCenters(
    state: StationState,
    companyId: string
): { locationId: string; nodeId: string }[] {
    return [
        ...state.stations.flatMap((station) =>
            station.status === 'placed' && station.companyId === companyId
                ? [{ locationId: station.position.locationId, nodeId: station.position.nodeId }]
                : []
        ),
        ...(state.stationAccess ?? []).flatMap((access) =>
            access.companyId === companyId
                ? [{ locationId: access.locationId, nodeId: access.nodeId }]
                : []
        )
    ]
}

type CenterPosition = { locationId: string; nodeId: string }

/** Whether two positions name the same city or stop. */
export function sameCenter(a: CenterPosition, b: CenterPosition): boolean {
    return a.locationId === b.locationId && a.nodeId === b.nodeId
}

export function usesStationAt(
    state: StationState,
    companyId: string,
    locationId: string,
    nodeId: string
): boolean {
    return companyStationCenters(state, companyId).some((center) =>
        sameCenter(center, { locationId, nodeId })
    )
}

export function replaceStation(state: StationState, previousId: string, nextId: string): void {
    const previous = state.stations.find((station) => station.id === previousId)
    const next = state.stations.find((station) => station.id === nextId)
    assert(previous?.status === 'placed', 'Station replacement requires a placed station')
    assert(next?.status === 'available', 'Station replacement requires an available station')
    state.stations = state.stations.map((station): Station => {
        if (station.id === previousId)
            return { id: previous.id, companyId: previous.companyId, status: 'removed' }
        if (station.id === nextId)
            return { ...next, status: 'placed', position: { ...previous.position } }
        return station
    })
}
export function validateStations(
    state: StationState,
    companyIds: readonly string[],
    neutral: NeutralStations
): void {
    assert(
        new Set(state.stations.map((station) => station.id)).size === state.stations.length,
        'Duplicate station'
    )
    const positions = new Set<string>()
    for (const station of state.stations) {
        assert(companyIds.includes(station.companyId), 'Unknown station company')
        if (station.status !== 'placed') continue
        const { locationId, nodeId, slot } = station.position
        const key = JSON.stringify([locationId, nodeId, slot])
        assert(!positions.has(key), 'Two stations occupy the same slot')
        positions.add(key)
    }
    for (const reservation of state.stationReservations)
        assert(companyIds.includes(reservation.companyId), 'Unknown reservation company')
    for (const access of state.stationAccess ?? [])
        assert(companyIds.includes(access.companyId), 'Unknown station access company')
    for (const definition of neutral.neutralStations) {
        assert(
            state.stations.some((station) => station.id === definition.stationId),
            'Unknown neutral station'
        )
        assert(
            definition.heldBy === undefined || companyIds.includes(definition.heldBy),
            'Unknown neutral station holder'
        )
    }
}

/**
 * How many of a city's spaces hold stations. A station beside a full city, such as 1822's
 * Metropolitan Railway in London, fills none of them.
 */
export function filledStationSpaces(
    state: Pick<StationState, 'stations'>,
    locationId: string,
    node: Extract<TileNode, { kind: 'city' }>
): number {
    return state.stations.filter(
        (station) =>
            station.status === 'placed' &&
            station.position.locationId === locationId &&
            station.position.nodeId === node.id &&
            station.position.slot < node.stationSlots
    ).length
}

export function cityIsBlocked(
    state: StationState,
    neutral: NeutralStations,
    companyId: string,
    locationId: string,
    node: TileNode
): boolean {
    return cityBlockedForCompanies(state, neutral, [companyId], locationId, node)
}

/**
 * Whether a city is full of stations none of which belongs to any of these companies, so that
 * no route of theirs passes it: companies merging trace their connections together (1861 §12.3).
 */
export function cityBlockedForCompanies(
    state: StationState,
    neutral: NeutralStations,
    companyIds: readonly string[],
    locationId: string,
    node: TileNode
): boolean {
    if (node.kind !== 'city' || node.stationSlots === 0) return false
    return (
        filledStationSpaces(state, locationId, node) >= node.stationSlots &&
        !companyIds.some((companyId) => usesStationAt(state, companyId, locationId, node.id)) &&
        !cityHasNeutralStation(state, neutral, locationId, node.id)
    )
}

/** Takes a company's stations off the board and its charter, with any reserved home. */
export function removeCompanyStations(
    state: Pick<StationState, 'stations' | 'stationReservations'>,
    companyId: string
): void {
    state.stations = state.stations.map((station) =>
        station.companyId === companyId ? { id: station.id, companyId, status: 'removed' } : station
    )
    state.stationReservations = state.stationReservations.filter(
        (reservation) => reservation.companyId !== companyId
    )
}

export function homeStationId(companyId: string): string {
    return `${companyId}:home`
}

export function createCompanyStations(companyId: string, count: number): Station[] {
    return Array.from({ length: count }, (_, index) => companyStation(companyId, index))
}

/** Adds stations from the supply to the company's charter, returning their ids. */
export function addCompanyStations(
    state: StationState,
    companyId: string,
    count: number
): string[] {
    const existing = state.stations.filter((station) => station.companyId === companyId).length
    const added = Array.from({ length: count }, (_, index) =>
        companyStation(companyId, existing + index)
    )
    state.stations.push(...added)
    return added.map((station) => station.id)
}

function companyStation(companyId: string, index: number): Station {
    return {
        id: index ? `${companyId}:station:${index}` : homeStationId(companyId),
        companyId,
        status: 'available'
    }
}
