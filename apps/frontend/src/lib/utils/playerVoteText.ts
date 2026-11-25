import { APIError } from '@tabletop/frontend-components'
import {
    PlayerVoteKind,
    requiredCallApprovals,
    votingPlayers,
    type Player,
    type PlayerVote,
    type UndoVotePreview
} from '@tabletop/common'
import { countOf } from './gameStats'

export function undoneDetail(preview: UndoVotePreview): string {
    return `moves by ${countOf(preview.affectedPlayerIds.length, 'player')}`
}

export function undoneSummary(preview: UndoVotePreview): string {
    return `Undoes ${undoneDetail(preview)}.`
}

export function voteErrorMessage(error: unknown): string {
    const reason = error instanceof APIError ? error.metadata['reason'] : undefined
    return typeof reason === 'string'
        ? `That didn't work: ${reason}.`
        : 'That did not work. Please try again.'
}

export function voteRequest(vote: PlayerVote): string {
    return vote.kind === PlayerVoteKind.Undo
        ? 'is asking to undo to an earlier point'
        : 'is asking to end the game'
}

export function voteDetail(
    vote: PlayerVote,
    undoPreview: UndoVotePreview | undefined,
    playerName: (playerId: string) => string
): string | undefined {
    if (vote.kind === PlayerVoteKind.Undo) {
        return undoPreview && `undoing ${undoneDetail(undoPreview)}`
    }
    return callWinnerDetail(
        vote.declaredWinnerId === undefined ? undefined : playerName(vote.declaredWinnerId)
    )
}

export function callWinnerDetail(winnerName: string | undefined): string {
    return winnerName === undefined ? 'with no winner' : `with ${winnerName} as the winner`
}

export function voteTally(
    vote: PlayerVote,
    players: readonly Pick<Player, 'id' | 'userId'>[]
): string {
    const approvals = vote.approvingPlayerIds.length
    return vote.kind === PlayerVoteKind.Undo
        ? `${approvals} of ${votingPlayers(players).length} agreed`
        : `${approvals} of ${requiredCallApprovals(players)} needed`
}
