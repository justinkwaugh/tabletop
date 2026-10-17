import { APIError } from '@tabletop/frontend-components'
import type { UndoVotePreview } from '@tabletop/common'
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
