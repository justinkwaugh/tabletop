import { type Static, Type } from 'typebox'
import { OffsetCoordinates } from '@tabletop/common'

export enum StationType {
    EnergyNode = 'EnergyNode',
    SundiverFoundry = 'SundiverFoundry',
    TransmitTower = 'TransmitTower'
}

export type BaseStation = Static<typeof BaseStation>
export const BaseStation = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    coords: Type.Optional(OffsetCoordinates)
})

export type EnergyNode = Static<typeof EnergyNode>
export const EnergyNode = Type.Evaluate(
    Type.Intersect([
        BaseStation,
        Type.Object({
            type: Type.Literal(StationType.EnergyNode)
        })
    ])
)

export type SundiverFoundry = Static<typeof SundiverFoundry>
export const SundiverFoundry = Type.Evaluate(
    Type.Intersect([
        BaseStation,
        Type.Object({
            type: Type.Literal(StationType.SundiverFoundry)
        })
    ])
)

export type TransmitTower = Static<typeof TransmitTower>
export const TransmitTower = Type.Evaluate(
    Type.Intersect([
        BaseStation,
        Type.Object({
            type: Type.Literal(StationType.TransmitTower)
        })
    ])
)

export type Station = Static<typeof Station>
export const Station = Type.Union([EnergyNode, SundiverFoundry, TransmitTower])
