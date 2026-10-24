import { ActionSource, type GameAction, type Round } from '@tabletop/common'
import {
    MachineState,
    isCalculateMarket,
    isEndYear,
    isGrowSunflowers,
    isHarvest,
    isMoveCompost,
    isReactSoil,
    isReadMessage,
    isRevealPlans,
    isScoreGame,
    isSellPotatoes,
    type MarketBoardId,
    type PlanningState,
    type RevealPlans
} from '@tabletop/dicke-kartoffeln'
import { describeOutcome, describeSystemAction, type Description } from './describe.js'
import { yearOf } from './ledger.js'
import { isYearEndAction } from './yearEnd.js'

export type YearEntry = { kind: 'year'; key: string; year: number; firstIndex: number }

export type PlanningEntry = {
    kind: 'planning'
    key: string
    round: PlanningState
    sealed: string[]
    reveal?: RevealPlans
    lastIndex: number
}

export type EventEntry = { kind: 'event'; key: string; round: MachineState; action: GameAction }

export type HistoryEntry = YearEntry | PlanningEntry | EventEntry

const EVENT_ROUNDS: readonly [(action: GameAction) => boolean, MachineState][] = [
    [isGrowSunflowers, MachineState.GrowingSunflowers],
    [isReadMessage, MachineState.ReadingMessage],
    [isHarvest, MachineState.Harvesting],
    [isCalculateMarket, MachineState.CalculatingMarket],
    [isSellPotatoes, MachineState.Selling],
    [isReactSoil, MachineState.SoilReacting],
    [isMoveCompost, MachineState.MovingCompost],
    [isEndYear, MachineState.EndingYear],
    [isScoreGame, MachineState.FinalScoring]
]

export function planningRound(groupId: string | undefined): PlanningState | undefined {
    const round = groupId?.split('-')[1]
    switch (round) {
        case MachineState.TakingCompost:
        case MachineState.Cultivating:
        case MachineState.Sowing:
        case MachineState.Fertilizing:
        case MachineState.Spraying:
        case MachineState.RegisteringSales:
        case MachineState.SpreadingCompost:
            return round
        default:
            return undefined
    }
}

export function historyEntries(
    actions: readonly GameAction[],
    years: readonly Round[]
): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: PlanningEntry | undefined
    let year: number | undefined
    for (const action of actions) {
        const index = action.index ?? 0
        const actionYear = yearOf(index, years)
        if (actionYear !== undefined && actionYear !== year) {
            year = actionYear
            entries.push({ kind: 'year', key: `year-${year}`, year, firstIndex: index })
        }
        if (action.source === ActionSource.User && action.playerId) {
            const round = planningRound(action.simultaneousGroupId)
            if (!round) continue
            if (!open || open.round !== round || open.reveal) {
                open = { kind: 'planning', key: action.id, round, sealed: [], lastIndex: index }
                entries.push(open)
            }
            open.sealed.push(action.playerId)
            open.lastIndex = index
            continue
        }
        if (isRevealPlans(action)) {
            if (open && open.round === action.step && !open.reveal) {
                open.reveal = action
                open.lastIndex = index
            }
            continue
        }
        const round = EVENT_ROUNDS.find(([matches]) => matches(action))?.[1]
        if (round) {
            entries.push({ kind: 'event', key: action.id, round, action })
        }
    }
    return entries
}

export function stepDescription(
    actions: readonly GameAction[],
    board: MarketBoardId
): Description[] {
    const start = actions.findLastIndex(
        (action) =>
            (action.source === ActionSource.User && action.playerId) || isYearEndAction(action)
    )
    const head = actions[start]
    const opening: Description[] =
        head?.source === ActionSource.User && head.playerId
            ? [[{ playerId: head.playerId }, 'sealed a plan']]
            : []
    return [
        ...opening,
        ...actions
            .slice(start + 1)
            .flatMap((action) =>
                isRevealPlans(action)
                    ? (action.metadata?.outcomes ?? []).map(describeOutcome)
                    : describeSystemAction(action, board)
            )
    ]
}
