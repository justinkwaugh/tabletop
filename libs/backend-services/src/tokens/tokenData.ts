import { Type, type Static } from 'typebox'

export type GameInvitationTokenData = Static<typeof GameInvitationTokenData>
export const GameInvitationTokenData = Type.Object({
    gameId: Type.String(),
    userId: Type.String()
})

export type AuthenticationTokenData = Static<typeof AuthenticationTokenData>
export const AuthenticationTokenData = Type.Object({
    userId: Type.String(),
    email: Type.String()
})

export type VerificationTokenData = Static<typeof VerificationTokenData>
export const VerificationTokenData = Type.Object({
    userId: Type.String(),
    email: Type.String()
})

export type SSEAuthorizationTokenData = Static<typeof SSEAuthorizationTokenData>
export const SSEAuthorizationTokenData = Type.Object({
    userId: Type.String()
})
