import * as Type from 'typebox'
import { GameAction } from './gameAction.js'

export type CanonicalActionReplay = Type.Static<typeof CanonicalActionReplay>
export const CanonicalActionReplay = Type.Object({
    startIndex: Type.Integer({ minimum: 0 }),
    userActions: Type.Array(GameAction)
})

export type CanonicalActionReplayManifest = Type.Static<typeof CanonicalActionReplayManifest>
export const CanonicalActionReplayManifest = Type.Object({
    startIndex: Type.Integer({ minimum: 0 }),
    userActionIds: Type.Array(Type.String())
})
