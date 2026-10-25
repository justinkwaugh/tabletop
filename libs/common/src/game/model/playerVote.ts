import * as Type from 'typebox'
import type { Player } from './player.js'

export enum PlayerVoteKind {
    Undo = 'undo',
    Call = 'call'
}

export enum PlayerVoteOutcome {
    Open = 'open',
    Passed = 'passed',
    Failed = 'failed'
}

export type UndoVote = Type.Static<typeof UndoVote>
export const UndoVote = Type.Object({
    id: Type.String(),
    kind: Type.Literal(PlayerVoteKind.Undo),
    initiatorPlayerId: Type.String(),
    targetActionId: Type.String(),
    targetActionIndex: Type.Integer({ minimum: 0 }),
    approvingPlayerIds: Type.Array(Type.String())
})

export type CallVote = Type.Static<typeof CallVote>
export const CallVote = Type.Object({
    id: Type.String(),
    kind: Type.Literal(PlayerVoteKind.Call),
    initiatorPlayerId: Type.String(),
    declaredWinnerId: Type.Optional(Type.String()),
    approvingPlayerIds: Type.Array(Type.String()),
    decliningPlayerIds: Type.Array(Type.String())
})

export type PlayerVote = Type.Static<typeof PlayerVote>
export const PlayerVote = Type.Union([UndoVote, CallVote])

export type UndoVotePreview = Type.Static<typeof UndoVotePreview>
export const UndoVotePreview = Type.Object({
    targetActionId: Type.String(),
    targetActionIndex: Type.Integer({ minimum: 0 }),
    affectedPlayerIds: Type.Array(Type.String()),
    ownUndoReaches: Type.Boolean()
})

type VotingPlayer = Pick<Player, 'id' | 'userId'>

export function votingPlayers<T extends Pick<Player, 'userId'>>(players: readonly T[]): T[] {
    return players.filter((player) => player.userId !== undefined)
}

export function isTwoPlayerGame(players: readonly unknown[]): boolean {
    return players.length === 2
}

export function requiredCallApprovals(players: readonly VotingPlayer[]): number {
    return isTwoPlayerGame(players) ? 1 : Math.floor(votingPlayers(players).length / 2) + 1
}

export function playerVoteOutcome(
    vote: PlayerVote,
    players: readonly VotingPlayer[]
): PlayerVoteOutcome {
    const voters = votingPlayers(players)
    const approvals = voters.filter((player) => vote.approvingPlayerIds.includes(player.id))
    if (vote.kind === PlayerVoteKind.Undo) {
        return approvals.length === voters.length
            ? PlayerVoteOutcome.Passed
            : PlayerVoteOutcome.Open
    }
    const required = requiredCallApprovals(players)
    if (approvals.length >= required) return PlayerVoteOutcome.Passed
    const undecided = voters.filter(
        (player) =>
            !vote.approvingPlayerIds.includes(player.id) &&
            !vote.decliningPlayerIds.includes(player.id)
    )
    return approvals.length + undecided.length < required
        ? PlayerVoteOutcome.Failed
        : PlayerVoteOutcome.Open
}
