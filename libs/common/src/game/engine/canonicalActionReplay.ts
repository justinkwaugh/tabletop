import * as Type from 'typebox'
import { GameAction } from './gameAction.js'

export type ProcessedActionReplay = Type.Static<typeof ProcessedActionReplay>
export const ProcessedActionReplay = Type.Object({
    startIndex: Type.Integer({ minimum: 0 }),
    actions: Type.Array(GameAction)
})

export type CanonicalActionReplay = Type.Static<typeof CanonicalActionReplay>
export const CanonicalActionReplay = Type.Object({
    ...ProcessedActionReplay.properties,
    // Compatibility for UI Artifacts that replay only User Actions.
    userActions: Type.Array(GameAction)
})

export type CanonicalActionReplayManifest = Type.Static<typeof CanonicalActionReplayManifest>
export const CanonicalActionReplayManifest = Type.Object({
    startIndex: Type.Integer({ minimum: 0 }),
    actionIds: Type.Array(Type.String()),
    // Compatibility for UI Artifacts that replay only User Actions.
    userActionIds: Type.Array(Type.String())
})
