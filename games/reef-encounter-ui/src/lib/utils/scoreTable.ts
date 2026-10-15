import {
    compareScores,
    CoralColors,
    type CoralColor,
    type CoralCounts,
    type ScoreBreakdown,
    TieBreakOrder,
    type TieBreakCriterion
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

const TieBreakNames: Record<TieBreakCriterion, string> = {
    consumedPolyps: 'consumed polyps',
    larvaCubes: 'unplayed larva cubes',
    supplyPolyps: 'unplayed polyps in the supply',
    guardedPolyps: 'polyps in corals their shrimps guard'
}

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
        const decider = TieBreakOrder.find((key) => ahead[key] !== behind[key])
        return decider
            ? [
                  {
                      aheadId,
                      behindId,
                      criterion: TieBreakNames[decider],
                      ahead: ahead[decider],
                      behind: behind[decider]
                  }
              ]
            : []
    })
    return { rows, tieBreaks }
}
