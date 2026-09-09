import * as Type from 'typebox'
import { assert } from '@tabletop/common'

const Id = Type.String({ minLength: 1 })
export const CityReservation = Type.Object(
    { companyId: Id, nodeId: Id },
    { additionalProperties: false }
)
export const StationReservation = Type.Object(
    {
        ...CityReservation.properties,
        locationId: Id
    },
    { additionalProperties: false }
)
export type StationReservation = Type.Static<typeof StationReservation>
export const StationPosition = Type.Object(
    {
        locationId: Id,
        nodeId: Id,
        slot: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type StationPosition = Type.Static<typeof StationPosition>
const Identity = { id: Id, companyId: Id }
export const Station = Type.Union([
    Type.Object(
        { ...Identity, status: Type.Literal('available') },
        { additionalProperties: false }
    ),
    Type.Object(
        { ...Identity, status: Type.Literal('placed'), position: StationPosition },
        { additionalProperties: false }
    ),
    Type.Object({ ...Identity, status: Type.Literal('removed') }, { additionalProperties: false })
])
export type Station = Type.Static<typeof Station>
export const StationFields = {
    stations: Type.Array(Station),
    stationReservations: Type.Array(StationReservation)
}
export type StationState = Type.Static<Type.TObject<typeof StationFields>>

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
export function validateStations(state: StationState, companyIds: readonly string[]): void {
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
}
