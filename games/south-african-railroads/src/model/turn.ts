import * as Type from 'typebox'
import { RailroadId } from '../maps/types.js'

// A railroad chosen to build for a player who controls no railroad able to build.
export type Delegation = Type.Static<typeof Delegation>
export const Delegation = Type.Object({
    railroadId: Type.Enum(RailroadId),
    builderId: Type.String()
})

// The railroad that must make its free first link from home after its share is auctioned.
export type FreeBuildDue = Type.Static<typeof FreeBuildDue>
export const FreeBuildDue = Type.Object({
    railroadId: Type.Enum(RailroadId),
    playerId: Type.String()
})
