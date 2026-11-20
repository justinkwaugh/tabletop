import type { GameAction } from '@tabletop/common'
import {
    type BarrelTieBreak,
    isBeginDawn,
    isScoreGame,
    LastEpoch,
    sunray,
    voyageSpace,
    type VoyageSpaceId,
    type WritId
} from '@tabletop/feudum'
import { plural } from '$lib/utils/words.js'

export interface GameEndColumn {
    readonly playerId: string
    /** R-6.3 What the seat had scored before the V dawn, so that the column adds up to its total. */
    readonly beforeDawn: number
    /** R-6.1 What the V dawn scored this seat. */
    readonly fifthDawn: number
    /** R-6.2 The section it reached and what that pays; with no disc, it says so. */
    readonly voyage: { readonly label: string; readonly vp: number }
    /** R-6.2 Its sets, and what they are made of. */
    readonly largeEmpire: { readonly label: string; readonly vp: number }
    readonly shillings: { readonly label: string; readonly vp: number }
    /** R-4.4.3, R-6.2 Every sealed charter, face up with its score. */
    readonly charters: readonly { readonly writId: WritId; readonly vp: number }[]
    /** R-6.3 The final score. */
    readonly score: number
    readonly winner: boolean
}

/** R-6.3 The barrel broke the tie only when it left fewer winners than were tied. */
export interface GameEndTie {
    readonly broken: boolean
    readonly seats: readonly { readonly playerId: string; readonly barrel: number }[]
    readonly shared: boolean
}

export interface GameEndSummaryView {
    readonly columns: readonly GameEndColumn[]
    /** R-6.3 The winners, each drawn as its seat's chip. */
    readonly winners: readonly string[]
    /** R-6.3 Only when the vp were tied: broken by the barrel, or still shared. */
    readonly tieBreak?: GameEndTie
}

function voyageLabel(spaceId: VoyageSpaceId | undefined): string {
    const on = spaceId && voyageSpace(spaceId)
    return on ? `Section ${on.section} · space ${on.space}` : 'No disc'
}

/** R-6.3 "Tie: most sulfur in the wine barrel; still tied, shared." */
function tieOf(tie: BarrelTieBreak, winners: readonly string[]): GameEndTie {
    return {
        broken: winners.length < tie.length,
        seats: tie.map(({ playerId, barrel }) => ({ playerId, barrel })),
        shared: winners.length > 1
    }
}

/** R-6.2, R-6.3 The summary, from ScoreGame's metadata: it needs nothing else to stand. */
export function gameEndOf(actions: readonly GameAction[]): GameEndSummaryView | undefined {
    const score = actions.findLast((action) => isScoreGame(action))
    const metadata = isScoreGame(score) ? score.metadata : undefined
    if (!metadata) {
        return undefined
    }
    const dawn = actions.findLast(
        (action) =>
            isBeginDawn(action) &&
            action.metadata !== undefined &&
            sunray(action.metadata.epoch).epoch === LastEpoch
    )
    const sheet = isBeginDawn(dawn) ? (dawn.metadata?.sheet ?? []) : []
    return {
        columns: metadata.sheet.map(
            ({ playerId, voyage, largeEmpire, shillings, charters, total, score: final }) => {
                const fifthDawn = sheet.find((row) => row.playerId === playerId)?.total ?? 0
                return {
                    playerId,
                    beforeDawn: final - total - fifthDawn,
                    fifthDawn,
                    voyage: { label: voyageLabel(voyage.space), vp: voyage.vp },
                    largeEmpire: {
                        label: `${plural(largeEmpire.sets, 'set')}: ${plural(largeEmpire.outposts, 'outpost')}, ${plural(largeEmpire.farms, 'farm')}, ${plural(largeEmpire.towns, 'town')}, ${plural(largeEmpire.feudums, 'feudum')}`,
                        vp: largeEmpire.vp
                    },
                    shillings: { label: `${shillings.held}s`, vp: shillings.vp },
                    charters,
                    score: final,
                    winner: metadata.winners.includes(playerId)
                }
            }
        ),
        winners: metadata.winners,
        ...(metadata.barrelTieBreak
            ? { tieBreak: tieOf(metadata.barrelTieBreak, metadata.winners) }
            : {})
    }
}
