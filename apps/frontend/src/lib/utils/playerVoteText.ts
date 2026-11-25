import { APIError } from '@tabletop/frontend-components'
import {
    PlayerVoteKind,
    requiredCallApprovals,
    votingPlayers,
    type Player,
    type PlayerVote,
    type UndoVotePreview
} from '@tabletop/common'
import { m } from '$lib/paraglide/messages'
import type { MessagePart } from '@tabletop/common'

export type VoteRequestForm = 'line' | 'sentence'

const VOTE_REQUEST_MESSAGES = {
    line: {
        undo: m.games_vote_undo_request,
        undoing: m.games_vote_undo_request_undoing,
        noWinner: m.games_vote_call_request_no_winner,
        winner: m.games_vote_call_request_winner
    },
    sentence: {
        undo: m.games_vote_undo_request_sentence,
        undoing: m.games_vote_undo_request_undoing_sentence,
        noWinner: m.games_vote_call_request_no_winner_sentence,
        winner: m.games_vote_call_request_winner_sentence
    }
}

export function undoneSummary(preview: UndoVotePreview): string {
    return m.games_vote_undoes_moves({ count: preview.affectedPlayerIds.length })
}

export function voteErrorMessage(error: unknown): string {
    const reason = error instanceof APIError ? error.metadata['reason'] : undefined
    return typeof reason === 'string'
        ? m.games_vote_failed_reason({ reason })
        : m.games_vote_failed()
}

export function voteRequestParts(
    vote: PlayerVote,
    undoPreview: UndoVotePreview | undefined,
    playerName: (playerId: string) => string,
    form: VoteRequestForm
): MessagePart[] {
    const messages = VOTE_REQUEST_MESSAGES[form]
    const name = playerName(vote.initiatorPlayerId)
    if (vote.kind === PlayerVoteKind.Undo) {
        return undoPreview
            ? messages.undoing.parts({ name, count: undoPreview.affectedPlayerIds.length })
            : messages.undo.parts({ name })
    }
    return vote.declaredWinnerId === undefined
        ? messages.noWinner.parts({ name })
        : messages.winner.parts({ name, winner: playerName(vote.declaredWinnerId) })
}

export function voteTally(
    vote: PlayerVote,
    players: readonly Pick<Player, 'id' | 'userId'>[]
): string {
    const approvals = vote.approvingPlayerIds.length
    return vote.kind === PlayerVoteKind.Undo
        ? m.games_vote_tally_agreed({ approvals, total: votingPlayers(players).length })
        : m.games_vote_tally_needed({ approvals, required: requiredCallApprovals(players) })
}
