import * as Type from 'typebox'
import { AxialCoordinates, PointyHexDirection } from '@tabletop/common'

export type RoadEnds = Type.Static<typeof RoadEnds>
export const RoadEnds = Type.Tuple([Type.Enum(PointyHexDirection), Type.Enum(PointyHexDirection)])

export type RoadTile = Type.Static<typeof RoadTile>
export const RoadTile = Type.Object({
    playerId: Type.String(),
    coords: AxialCoordinates,
    ends: RoadEnds
})

export type City = Type.Static<typeof City>
export const City = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    spaces: Type.Array(AxialCoordinates)
})

export type Oracle = Type.Static<typeof Oracle>
export const Oracle = Type.Object({
    coords: AxialCoordinates,
    attentionCityId: Type.Optional(Type.String())
})

export type Market = Type.Static<typeof Market>
export const Market = Type.Object({
    playerId: Type.String(),
    placeId: Type.String(),
    coords: AxialCoordinates,
    sold: Type.Boolean()
})
