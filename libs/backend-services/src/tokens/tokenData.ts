import { Type, type Static } from 'typebox'

export type GameInvitationTokenData = Static<typeof GameInvitationTokenData>
export const GameInvitationTokenData = Type.Object({
    gameId: Type.String(),
    userId: Type.String()
})

export type SSEAuthorizationTokenData = Static<typeof SSEAuthorizationTokenData>
export const SSEAuthorizationTokenData = Type.Object({
    userId: Type.String()
})
