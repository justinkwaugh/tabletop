import * as Type from 'typebox'
import { OffsetCoordinates } from '@tabletop/common'

export enum StationType {
    EnergyNode = 'EnergyNode',
    SundiverFoundry = 'SundiverFoundry',
    TransmitTower = 'TransmitTower'
}

export type BaseStation = Type.Static<typeof BaseStation>
export const BaseStation = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    coords: Type.Optional(OffsetCoordinates)
})

export type EnergyNode = Type.Static<typeof EnergyNode>
export const EnergyNode = Type.Evaluate(
    Type.Intersect([
        BaseStation,
        Type.Object({
            type: Type.Literal(StationType.EnergyNode)
        })
    ])
)

export function isEnergyNode(station: Station): station is EnergyNode {
    return station.type === StationType.EnergyNode
}

export type SundiverFoundry = Type.Static<typeof SundiverFoundry>
export const SundiverFoundry = Type.Evaluate(
    Type.Intersect([
        BaseStation,
        Type.Object({
            type: Type.Literal(StationType.SundiverFoundry)
        })
    ])
)

export function isSundiverFoundry(station: Station): station is SundiverFoundry {
    return station.type === StationType.SundiverFoundry
}

export type TransmitTower = Type.Static<typeof TransmitTower>
export const TransmitTower = Type.Evaluate(
    Type.Intersect([
        BaseStation,
        Type.Object({
            type: Type.Literal(StationType.TransmitTower)
        })
    ])
)

export function isTransmitTower(station: Station): station is TransmitTower {
    return station.type === StationType.TransmitTower
}

export type Station = Type.Static<typeof Station>
export const Station = Type.Union([EnergyNode, SundiverFoundry, TransmitTower])
