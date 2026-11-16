import { TalonSize, type CompletedTrick } from '@tabletop/koenigrufen'
import {
    defenderCollector,
    talonGoesToDefenders,
    talonViewOf,
    type TalonTable
} from './talonView.js'

export type WonCardsTable = TalonTable & {
    readonly tricks: readonly CompletedTrick[]
    getPlayerState(playerId: string): {
        readonly discardCount: number
        readonly shownDiscards: readonly string[]
    }
}

// The cards lying face down in a player's capture pile: won tricks, the declarer's cards laid
// away face down, and the talon cards the defenders' collector gathered. Face-up cards are public,
// so they do not count.
export function wonCardCount(table: WonCardsTable, playerId: string): number {
    return (
        trickCards(table, playerId) +
        faceDownDiscards(table, playerId) +
        gatheredTalonCards(table, playerId)
    )
}

function trickCards(table: WonCardsTable, playerId: string): number {
    return table.tricks
        .filter((trick) => trick.winnerId === playerId)
        .reduce((count, trick) => count + trick.plays.length, 0)
}

function faceDownDiscards(table: WonCardsTable, playerId: string): number {
    if (table.contract?.declarerId !== playerId) {
        return 0
    }
    const { discardCount, shownDiscards } = table.getPlayerState(playerId)
    return discardCount - shownDiscards.length
}

function gatheredTalonCards(table: WonCardsTable, playerId: string): number {
    if (
        defenderCollector(table) !== playerId ||
        !talonGoesToDefenders(table) ||
        talonViewOf(table).kind !== 'gone'
    ) {
        return 0
    }
    if (table.rejectedTalonHalf) {
        return table.rejectedTalonHalf.length
    }
    return table.contractDefinition().talonCards === 0 ? TalonSize : 0
}
