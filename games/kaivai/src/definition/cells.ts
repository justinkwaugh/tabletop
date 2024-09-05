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
    owner: Type.String(),
    fish: Type.Number()
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
    boat: Type.Optional(Boat),
    fish: Type.Number()
})

export function isMeetingCell(cell?: Cell): cell is MeetingCell {
    return cell?.type === CellType.Meeting
}

export function isBoatBuildingCell(cell?: Cell): cell is BoatBuildingCell {
    return cell?.type === CellType.BoatBuilding
}

export function isFishingCell(cell?: Cell): cell is FishingCell {
    return cell?.type === CellType.Fishing
}

export function isPlayerCell(cell?: Cell): cell is MeetingCell | FishingCell | BoatBuildingCell {
    return isMeetingCell(cell) || isFishingCell(cell) || isBoatBuildingCell(cell)
}

export function isDeliverableCell(cell?: Cell): cell is MeetingCell | BoatBuildingCell {
    return isMeetingCell(cell) || (isBoatBuildingCell(cell) && !cell.boat && cell.fish < 3)
}

export function isDeliveryCell(cell?: Cell): cell is MeetingCell | BoatBuildingCell {
    return isMeetingCell(cell) || (isBoatBuildingCell(cell)
}

export function isIslandCell(
    cell?: Cell
): cell is CultCell | MeetingCell | FishingCell | BoatBuildingCell {
    return cell !== undefined && cell?.type !== CellType.Water
}

export function isBoatCell(cell?: Cell): cell is WaterCell | BoatBuildingCell {
    return cell?.type === CellType.Water || isBoatBuildingCell(cell)
}

export type Cell = Static<typeof Cell>
export const Cell = Type.Union([WaterCell, CultCell, MeetingCell, FishingCell, BoatBuildingCell])
