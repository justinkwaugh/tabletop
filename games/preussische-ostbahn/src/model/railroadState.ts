import * as Type from 'typebox'
import { RailroadId } from '../components/railroads.js'

export type RailroadState = Type.Static<typeof RailroadState>
export const RailroadState = Type.Object({
    id: Type.Enum(RailroadId),
    treasury: Type.Number(),
    owners: Type.Array(Type.String()),
    track: Type.Array(Type.String())
})
