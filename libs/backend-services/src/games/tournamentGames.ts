import {
    BaseError,
    GameStatus,
    type Game,
    type Tournament,
    type TournamentGameReference
} from '@tabletop/common'
import { createHash } from 'node:crypto'
import { derivedId } from '../competitions/derivedId.js'

/**
 * A Table's Game id, derived so that provisioning it again finds the same Game. Ids are as long
 * as an ordinary Game's, except in Tournaments created before `shortGameIds`.
 */
export function tournamentGameId(
    tournament: Pick<Tournament, 'shortGameIds'>,
    reference: Pick<TournamentGameReference, 'tournamentId' | 'stageId' | 'tableId' | 'attempt'>
): string {
    const base = [reference.tournamentId, reference.stageId, reference.tableId]
    const parts = reference.attempt ? [...base, reference.attempt] : base
    return tournament.shortGameIds
        ? derivedId(parts)
        : `tournament-${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`
}

/** What becomes of a Table whose Game is abandoned: never counted, or played again. */
export type TournamentTableRelease = 'void' | 'restart'

/** A seat passing from any earlier account of a place to its Substitute. */
export interface TournamentSeatHandover {
    gameId: string
    fromUserIds: string[]
    toUserId: string
    toName: string
}

export class TournamentGameError extends BaseError {
    constructor(message: string) {
        super({ name: 'TournamentGameError', message })
    }
}

export function assertOrdinaryGame(game: Pick<Game, 'tournament'>): void {
    if (game.tournament)
        throw new TournamentGameError('Tournament games are managed by the tournament.')
}

export function assertTournamentUndoAllowed(game: Pick<Game, 'tournament' | 'status'>): void {
    if (game.tournament && game.status === GameStatus.Finished)
        throw new TournamentGameError(
            'Finished tournament games are final. Corrections require tournament recovery.'
        )
}
