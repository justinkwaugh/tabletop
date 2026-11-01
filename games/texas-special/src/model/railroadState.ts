import * as Type from 'typebox'
import { RailroadId } from '../maps/types.js'

export type RailroadState = Type.Static<typeof RailroadState>
export const RailroadState = Type.Object({
    id: Type.Enum(RailroadId),
    open: Type.Boolean(),
    treasury: Type.Number(),
    // One entry per sold share, naming the player who holds it.
    owners: Type.Array(Type.String())
})

export type BuiltLink = Type.Static<typeof BuiltLink>
export const BuiltLink = Type.Object({
    linkId: Type.String(),
    railroadId: Type.Enum(RailroadId)
})

export type BuiltConnection = Type.Static<typeof BuiltConnection>
export const BuiltConnection = Type.Object({
    connectionId: Type.String(),
    railroadId: Type.Enum(RailroadId)
})
