import { StationType } from '../components/stations.js'
import * as Type from 'typebox'
import { OffsetCoordinates } from '@tabletop/common'

export type Activation = Type.Static<typeof Activation>
export const Activation = Type.Object({
    playerId: Type.String(),
    stationType: Type.Optional(Type.Enum(StationType)),
    activatedIds: Type.Array(Type.String()),
    currentStationId: Type.Optional(Type.String()),
    currentStationCoords: Type.Optional(OffsetCoordinates)
})
