import * as Type from 'typebox'

export enum GameCallKind {
    Called = 'called',
    Conceded = 'conceded',
    Stalled = 'stalled'
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

export type PlayerCall = Type.Static<typeof PlayerCall>
export const PlayerCall = Type.Evaluate(
    Type.Intersect([
        CallBallot,
        Type.Object({
            kind: Type.Union([
                Type.Literal(GameCallKind.Called),
                Type.Literal(GameCallKind.Conceded)
            ])
        })
    ])
)

export type StalledCall = Type.Static<typeof StalledCall>
export const StalledCall = Type.Object({ kind: Type.Literal(GameCallKind.Stalled) })

export type GameCall = Type.Static<typeof GameCall>
export const GameCall = Type.Union([PlayerCall, StalledCall])

export function isPlayerCall(call: GameCall): call is PlayerCall {
    return call.kind !== GameCallKind.Stalled
}
