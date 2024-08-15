import { Type, type Static } from '@sinclair/typebox'

export enum PlayerStatus {
    Open = 'open',
    Reserved = 'reserved',
    Joined = 'joined',
    Declined = 'declined'
}

export type Player = Static<typeof Player>
export const Player = Type.Object({
    id: Type.String(),
    isHuman: Type.Boolean(),
    userId: Type.Optional(Type.String()),
    name: Type.String(),
    status: Type.Enum(PlayerStatus)
})
