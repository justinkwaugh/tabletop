import { Static, Type } from '@sinclair/typebox'
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
    coords: OffsetCoordinates
})

export type EnergyNode = Static<typeof EnergyNode>
export const EnergyNode = Type.Object({
    ...BaseStation.props,
    type: Type.Literal(StationType.EnergyNode)
})

export type SundiverFoundry = Static<typeof SundiverFoundry>
export const SundiverFoundry = Type.Object({
    ...BaseStation.props,
    type: Type.Literal(StationType.SundiverFoundry)
})

export type TransmitTower = Static<typeof TransmitTower>
export const TransmitTower = Type.Object({
    ...BaseStation.props,
    type: Type.Literal(StationType.TransmitTower)
})

export type Station = Static<typeof Station>
export const Station = Type.Union([EnergyNode, SundiverFoundry, TransmitTower])
