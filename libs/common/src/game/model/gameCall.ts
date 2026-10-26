import * as Type from 'typebox'

export enum GameCallKind {
    Called = 'called',
    Conceded = 'conceded'
}

// Who asked to end the game, for which winner, and who agreed or declined: shared by the open
// vote and the record of the call that ended the game.
export type CallBallot = Type.Static<typeof CallBallot>
export const CallBallot = Type.Object({
    initiatorPlayerId: Type.String(),
    declaredWinnerId: Type.Optional(Type.String()),
    approvingPlayerIds: Type.Array(Type.String()),
    decliningPlayerIds: Type.Array(Type.String())
})

export type GameCall = Type.Static<typeof GameCall>
export const GameCall = Type.Evaluate(
    Type.Intersect([CallBallot, Type.Object({ kind: Type.Enum(GameCallKind) })])
)
