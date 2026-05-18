import * as Type from 'typebox'

export enum BuildingType {
    House = 'house',
    Palace = 'palace',
    Tower = 'tower',
}

export const BUILDING_POINTS: Record<BuildingType, number> = {
    [BuildingType.House]: 1,
    [BuildingType.Palace]: 2,
    [BuildingType.Tower]: 3,
}

export type PlacedBuilding = Type.Static<typeof PlacedBuilding>
export const PlacedBuilding = Type.Object({
    playerId: Type.String(),
    buildingType: Type.Enum(BuildingType),
})

export type BoardSquare = Type.Static<typeof BoardSquare>
export const BoardSquare = Type.Union([PlacedBuilding, Type.Null()])
