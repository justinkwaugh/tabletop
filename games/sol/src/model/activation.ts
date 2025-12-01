import { Ring } from '../utils/solGraph.js'
import { StationType } from '../components/stations.js'
import { Type, Static } from 'typebox'
import { OffsetCoordinates } from '@tabletop/common'

export type Activation = Static<typeof Activation>
export const Activation = Type.Object({
    playerId: Type.String(),
    stationType: Type.Optional(Type.Enum(StationType)),
    activatedIds: Type.Array(Type.String()),
    currentStationId: Type.Optional(Type.String()),
    currentStationCoords: Type.Optional(OffsetCoordinates)
})
