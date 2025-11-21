import { Type, type Static } from 'typebox'
import { GoodsType } from '../definition/goodsType.js'

export enum CellType {
    OffBoard = 'off',
    Empty = 'empty',
    Road = 'road',
    Market = 'market',
    Disk = 'disk', // player owned
    Stall = 'stall', // player owned
    Truck = 'truck'
}

export type OffBoardCell = Static<typeof OffBoardCell>
export const OffBoardCell = Type.Object({
    type: Type.Literal(CellType.OffBoard)
})

export type EmptyCell = Static<typeof EmptyCell>
export const EmptyCell = Type.Object({
    type: Type.Literal(CellType.Empty)
})

export function isEmptyCell(cell: Cell): cell is EmptyCell {
    return cell.type === CellType.Empty
}

export type RoadCell = Static<typeof RoadCell>
export const RoadCell = Type.Object({
    type: Type.Literal(CellType.Road)
})

export type MarketCell = Static<typeof MarketCell>
export const MarketCell = Type.Object({
    type: Type.Literal(CellType.Market)
})

export type DiskCell = Static<typeof DiskCell>
export const DiskCell = Type.Object({
    type: Type.Literal(CellType.Disk),
    playerId: Type.String()
})

export function isDiskCell(cell: Cell): cell is DiskCell {
    return cell.type === CellType.Disk
}

export type StallCell = Static<typeof StallCell>
export const StallCell = Type.Object({
    type: Type.Literal(CellType.Stall),
    playerId: Type.String(),
    goodsType: Type.Enum(GoodsType)
})

export function isStallCell(cell: Cell): cell is StallCell {
    return cell.type === CellType.Stall
}

export type TruckCell = Static<typeof TruckCell>
export const TruckCell = Type.Object({
    type: Type.Literal(CellType.Truck),
    goodsType: Type.Enum(GoodsType)
})

export function isTruckCell(cell: Cell): cell is TruckCell {
    return cell.type === CellType.Truck
}

export type Cell = Static<typeof Cell>
export const Cell = Type.Union([
    OffBoardCell,
    EmptyCell,
    RoadCell,
    MarketCell,
    DiskCell,
    StallCell,
    TruckCell
])

export const PopulatedCellTypes = [
    CellType.Market,
    CellType.Disk,
    CellType.Stall,
    CellType.Truck,
    CellType.Road
]

export type PopulatedCell = Static<typeof PopulatedCell>
export const PopulatedCell = Type.Union([MarketCell, DiskCell, StallCell, TruckCell, RoadCell])

export function isTraversable(cell: Cell): boolean {
    return (
        cell.type === CellType.Empty || cell.type === CellType.Road || cell.type === CellType.Disk
    )
}

export function mustBeReachable(cell: Cell): boolean {
    return (
        cell.type === CellType.Empty ||
        cell.type === CellType.Road ||
        cell.type === CellType.Disk ||
        cell.type === CellType.Stall ||
        cell.type === CellType.Truck
    )
}

export function canBeBlocked(cell: Cell): boolean {
    return cell.type === CellType.Empty || cell.type === CellType.Disk
}
