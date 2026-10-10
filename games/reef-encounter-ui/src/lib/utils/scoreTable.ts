import {
    compareScores,
    CoralColors,
    type CoralColor,
    type CoralCounts,
    type ScoreBreakdown
} from '@tabletop/reef-encounter'

export type ScoreCell = { color: CoralColor; polyps: number; points: number }

export type ScoreRow = { playerId: string; place: number; total: number; cells: ScoreCell[] }

export type TieBreak = {
    aheadId: string
    behindId: string
    criterion: string
    ahead: number
    behind: number
}

export type ScoreTable = { rows: ScoreRow[]; tieBreaks: TieBreak[] }

// Rulebook p. 12, in order.
const TieBreakCriteria: {
    key: Exclude<keyof ScoreBreakdown, 'parrotfishPolyps' | 'total'>
    name: string
}[] = [
    { key: 'consumedPolyps', name: 'consumed polyps' },
    { key: 'larvaCubes', name: 'unplayed larva cubes' },
    { key: 'screenPolyps', name: 'unplayed polyps behind the screen' },
    { key: 'guardedPolyps', name: 'polyps in corals their shrimps guard' }
]

export function scoreTable(
    scores: Record<string, ScoreBreakdown>,
    values: CoralCounts,
    playerIds: readonly string[]
): ScoreTable {
    const ranked = [...playerIds].sort((a, b) => compareScores(scores[b], scores[a]))
    const rows = ranked.map((playerId, index) => {
        const score = scores[playerId]
        const tiedAbove = ranked.findIndex((other) => compareScores(scores[other], score) === 0)
        return {
            playerId,
            place: Math.min(index, tiedAbove) + 1,
            total: score.total,
            cells: CoralColors.map((color) => ({
                color,
                polyps: score.parrotfishPolyps[color],
                points: score.parrotfishPolyps[color] * values[color]
            }))
        }
    })
    const tieBreaks = ranked.slice(1).flatMap((behindId, index) => {
        const aheadId = ranked[index]
        const ahead = scores[aheadId]
        const behind = scores[behindId]
        if (ahead.total !== behind.total) return []
        const decider = TieBreakCriteria.find(({ key }) => ahead[key] !== behind[key])
        return decider
            ? [
                  {
                      aheadId,
                      behindId,
                      criterion: decider.name,
                      ahead: ahead[decider.key],
                      behind: behind[decider.key]
                  }
              ]
            : []
    })
    return { rows, tieBreaks }
}
