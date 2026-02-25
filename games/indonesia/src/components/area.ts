import { Good } from '../definition/goods.js'
import * as Type from 'typebox'

export enum AreaType {
    EmptyLand = 'EmptyLand',
    City = 'City',
    Cultivated = 'Cultivated',
    Sea = 'Sea'
}

export type BaseArea = Type.Static<typeof BaseArea>
export const BaseArea = Type.Object({
    type: Type.Enum(AreaType),
    id: Type.String()
})

export type EmptyLandArea = Type.Static<typeof EmptyLandArea>
export const EmptyLandArea = Type.Object({
    ...BaseArea.properties,
    type: Type.Literal(AreaType.EmptyLand)
})

export function isEmptyLandArea(area: Area): area is EmptyLandArea {
    return area.type === AreaType.EmptyLand
}

export type CityArea = Type.Static<typeof CityArea>
export const CityArea = Type.Object({
    ...BaseArea.properties,
    cityId: Type.String()
})

export function isCityArea(area: Area): area is CityArea {
    return area.type === AreaType.City
}

export type CultivatedArea = Type.Static<typeof CultivatedArea>
export const CultivatedArea = Type.Object({
    ...BaseArea.properties,
    companyId: Type.String(),
    good: Good
})

export function isCultivatedArea(area: Area): area is CultivatedArea {
    return area.type === AreaType.Cultivated
}

export type LandArea = CityArea | CultivatedArea | EmptyLandArea
export function isLandArea(area: Area): area is LandArea {
    return isEmptyLandArea(area) || isCityArea(area) || isCultivatedArea(area)
}

export type SeaArea = Type.Static<typeof SeaArea>
export const SeaArea = Type.Object({
    ...BaseArea.properties,
    type: Type.Literal(AreaType.Sea),
    ships: Type.Array(Type.String())
})

export function isSeaArea(area: Area): area is SeaArea {
    return area.type === AreaType.Sea
}

export type Area = Type.Static<typeof Area>
export const Area = Type.Union([EmptyLandArea, CityArea, CultivatedArea, SeaArea])
