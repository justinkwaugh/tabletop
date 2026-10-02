import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })
export const LocationMarker = Type.Object(
    { locationId: Id, kind: Id, privateCompanyId: Id },
    { additionalProperties: false }
)
export type LocationMarker = Type.Static<typeof LocationMarker>
export const LocationMarkerFields = { locationMarkers: Type.Optional(Type.Array(LocationMarker)) }
export type LocationMarkerState = Type.Static<Type.TObject<typeof LocationMarkerFields>>

export function locationMarkers(
    state: LocationMarkerState,
    filter: Partial<LocationMarker> = {}
): LocationMarker[] {
    return (state.locationMarkers ?? []).filter((marker) =>
        Object.entries(filter).every(([key, value]) => Reflect.get(marker, key) === value)
    )
}

export function placeLocationMarker(state: LocationMarkerState, marker: LocationMarker): void {
    state.locationMarkers = [...(state.locationMarkers ?? []), { ...marker }]
}
