import * as Type from 'typebox'

export enum GameCallKind {
    Called = 'called',
    Conceded = 'conceded'
}

export type GameCall = Type.Static<typeof GameCall>
export const GameCall = Type.Object({
    kind: Type.Enum(GameCallKind),
    initiatorPlayerId: Type.String(),
    declaredWinnerIds: Type.Array(Type.String()),
    approvingPlayerIds: Type.Array(Type.String()),
    decliningPlayerIds: Type.Array(Type.String())
})
