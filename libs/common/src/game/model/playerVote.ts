import * as Type from 'typebox'
import type { Player } from './player.js'

export enum PlayerVoteKind {
    Undo = 'undo'
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

export type PlayerVote = Type.Static<typeof PlayerVote>
export const PlayerVote = UndoVote

export type UndoVotePreview = Type.Static<typeof UndoVotePreview>
export const UndoVotePreview = Type.Object({
    targetActionId: Type.String(),
    targetActionIndex: Type.Integer({ minimum: 0 }),
    affectedPlayerIds: Type.Array(Type.String()),
    ownUndoReaches: Type.Boolean()
})

export function votingPlayers<T extends Pick<Player, 'userId'>>(players: readonly T[]): T[] {
    return players.filter((player) => player.userId !== undefined)
}

export function isPlayerVoteApproved(
    vote: Pick<PlayerVote, 'approvingPlayerIds'>,
    players: readonly Pick<Player, 'id' | 'userId'>[]
): boolean {
    return votingPlayers(players).every((player) => vote.approvingPlayerIds.includes(player.id))
}
