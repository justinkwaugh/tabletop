import type { AxialCoordinates } from '@tabletop/common'

export type PlaceId = string

export enum PlaceKind {
    City = 'City',
    Village = 'Village',
    Oracle = 'Oracle'
}

export type Place = {
    id: PlaceId
    kind: PlaceKind
    spaces: AxialCoordinates[]
    playerId?: string
}

export function cityPlaceId(cityId: string): PlaceId {
    return `city:${cityId}`
}

export function villagePlaceId(coords: AxialCoordinates): PlaceId {
    return `village:${coords.q},${coords.r}`
}

export function oraclePlaceId(coords: AxialCoordinates): PlaceId {
    return `oracle:${coords.q},${coords.r}`
}
