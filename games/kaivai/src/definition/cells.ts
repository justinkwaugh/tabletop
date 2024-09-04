import { Type, type Static } from '@sinclair/typebox'
import { AxialCoordinates } from '@tabletop/common'
import { Boat } from '../components/boat.js'
import { HutType } from './huts.js'

export enum CellType {
    Water = 'Water',
    Cult = 'Cult',
    Fishing = 'Fishing',
    BoatBuilding = 'BoatBuilding',
    Meeting = 'Meeting'
}

export type BaseCell = Static<typeof BaseCell>
export const BaseCell = Type.Object({
    type: Type.Enum(CellType),
    coords: AxialCoordinates
})

export type WaterCell = Static<typeof WaterCell>
export const WaterCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Water),
    boat: Type.Optional(Boat)
})

export type CultCell = Static<typeof CultCell>
export const CultCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Cult),
    islandId: Type.String()
})

export type MeetingCell = Static<typeof MeetingCell>
export const MeetingCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Meeting),
    islandId: Type.String(),
    hutType: Type.Literal(HutType.Meeting),
    owner: Type.String()
})

export type FishingCell = Static<typeof FishingCell>
export const FishingCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.Fishing),
    islandId: Type.String(),
    hutType: Type.Literal(HutType.Fishing),
    owner: Type.String()
})

export type BoatBuildingCell = Static<typeof BoatBuildingCell>
export const BoatBuildingCell = Type.Object({
    ...BaseCell.properties,
    type: Type.Literal(CellType.BoatBuilding),
    islandId: Type.String(),
    hutType: Type.Literal(HutType.BoatBuilding),
    owner: Type.String(),
    boat: Type.Optional(Boat)
})

export type Cell = Static<typeof Cell>
export const Cell = Type.Union([WaterCell, CultCell, MeetingCell, FishingCell, BoatBuildingCell])
