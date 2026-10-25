import { APIError } from '@tabletop/frontend-components'
import {
    nameList,
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

export function callWinnersDetail(winnerNames: readonly string[]): string {
    if (winnerNames.length === 0) return 'with no winner'
    return `with ${nameList(winnerNames)} as the ${winnerNames.length === 1 ? 'winner' : 'winners'}`
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
