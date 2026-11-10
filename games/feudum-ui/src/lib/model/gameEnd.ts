import type { GameAction } from '@tabletop/common'
import {
    EpicVoyageTrack,
    isBeginDawn,
    isScoreGame,
    LastEpoch,
    type BarrelTieBreak,
    type WritId
} from '@tabletop/feudum'

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

export interface GameEndSummaryView {
    readonly columns: readonly GameEndColumn[]
    readonly winnerLine: string
    /** R-6.3 Named only when the barrel broke a tie. */
    readonly tieBreak?: string
}

function joined(names: readonly string[]): string {
    return names.length < 2
        ? names.join('')
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function voyageLabel(space: number | undefined): string {
    const on = EpicVoyageTrack.find((row) => row.space === space)
    return on ? `Section ${on.section} · space ${on.space}` : 'No disc'
}

function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`
}

function tieBreakLine(tie: BarrelTieBreak, nameOf: (playerId: string) => string): string {
    const named = tie.map(({ playerId, barrel }) => `${nameOf(playerId)} ${barrel}`)
    return `Tie on vp broken by barrel sulfur: ${named.join(', ')}`
}

/** R-6.2, R-6.3 The summary, from ScoreGame's metadata: it needs nothing else to stand. */
export function gameEndOf(
    actions: readonly GameAction[],
    nameOf: (playerId: string) => string
): GameEndSummaryView | undefined {
    const score = actions.findLast((action) => isScoreGame(action))
    const metadata = isScoreGame(score) ? score.metadata : undefined
    if (!metadata) {
        return undefined
    }
    const dawn = actions.findLast(
        (action) => isBeginDawn(action) && action.metadata?.epoch === LastEpoch
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
        winnerLine: `${joined(metadata.winners.map(nameOf))} ${metadata.winners.length === 1 ? 'wins' : 'win'}`,
        ...(metadata.barrelTieBreak
            ? { tieBreak: tieBreakLine(metadata.barrelTieBreak, nameOf) }
            : {})
    }
}
