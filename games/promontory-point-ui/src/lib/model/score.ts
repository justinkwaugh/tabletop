import { RAILROAD_IDS, sharePriceAt, type RailroadId } from '@tabletop/promontory-point'
import { END_REASON_TEXT, endSummary } from '$lib/utils/endSummary.js'
import { RAILROAD_TAGS } from './railroadTags.js'

export type ScoreColumn = { railroadId: RailroadId; label: string }

export type ScoreRow = {
    playerId: string
    money: number
    // Per railroad, "count × final price", or "—" when none are held, and what they are worth.
    holdings: { railroadId: RailroadId; text: string; value: number }[]
    shareValue: number
    total: number
    winner: boolean
}

export type ScoreView = {
    winnerIds: string[]
    winningTotal: number
    reason: string | undefined
    columns: ScoreColumn[]
    // Highest total first; the score is sorted once and never reorders.
    rows: ScoreRow[]
}

// PlayerName names the viewer "You", so a verb after the names agrees with it: "You win".
export function viewerVerb(
    subjectIds: readonly string[],
    viewerId: string | undefined,
    singular: string,
    plural: string
): string {
    return subjectIds.length > 1 || (viewerId !== undefined && subjectIds.includes(viewerId))
        ? plural
        : singular
}

// R-6.1, R-6.2, R-6.2-H1: the score read from the final state; every tied leader wins.
export function scoreView(state: Parameters<typeof endSummary>[0]): ScoreView | undefined {
    const summary = endSummary(state)
    if (summary === undefined) {
        return undefined
    }
    const rows = summary.totals.map((total) => ({
        playerId: total.playerId,
        money: total.money,
        holdings: RAILROAD_IDS.map((railroadId) => {
            const { shares, price } = total.holdings[railroadId]
            return {
                railroadId,
                text: shares > 0 ? `${shares} × $${price}` : '—',
                value: shares * price
            }
        }),
        shareValue: total.shareValue,
        total: total.total,
        winner: summary.winnerIds.includes(total.playerId)
    }))
    return {
        winnerIds: rows.filter((row) => row.winner).map((row) => row.playerId),
        winningTotal: rows[0]?.total ?? 0,
        reason: summary.reason === undefined ? undefined : END_REASON_TEXT[summary.reason],
        columns: RAILROAD_IDS.map((railroadId) => ({
            railroadId,
            label: `${RAILROAD_TAGS[railroadId]} $${sharePriceAt(state.priceIndex[railroadId])}`
        })),
        rows
    }
}
