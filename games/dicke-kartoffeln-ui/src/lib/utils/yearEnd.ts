import type { GameAction, Round } from '@tabletop/common'
import {
    LOAN_AMOUNT,
    MachineState,
    isEndYear,
    isMoveCompost,
    isReactSoil,
    isRevealPlans,
    type EndYear,
    type MoveCompost,
    type ReactSoil,
    type RevealPlans
} from '@tabletop/dicke-kartoffeln'
import { compostParts, settlementParts, soilParts } from './describe.js'
import { marks } from './format.js'
import { yearOf } from './ledger.js'

// Rounds 9 to 12 close the year without anyone deciding, except who spreads compost in round 10.
export type YearEndRound =
    | MachineState.SoilReacting
    | MachineState.SpreadingCompost
    | MachineState.MovingCompost
    | MachineState.EndingYear

export const YEAR_END_ROUNDS: readonly YearEndRound[] = [
    MachineState.SoilReacting,
    MachineState.SpreadingCompost,
    MachineState.MovingCompost,
    MachineState.EndingYear
]

export const YEAR_END_RULES: Record<YearEndRound, string> = {
    [MachineState.SoilReacting]:
        'Each sown field loses a worm for its seed, one more for poison and one per sack of fertilizer. A living fallow field breeds a worm, up to 5. Chemicals leave a skull; a clean year takes it away.',
    [MachineState.SpreadingCompost]:
        'Worms from compost pile 2 are spread on fields for 100 marks a field, at most 5 worms a field. Worms left over are sold to the bank at 60 marks each.',
    [MachineState.MovingCompost]: 'Compost pile 1 moves onto pile 2, and its worms double.',
    [MachineState.EndingYear]:
        'Every loan that can be paid back is repaid. Each remaining loan costs 100 marks interest, borrowed if need be.'
}

export enum YearEndStatus {
    Resolved = 'Resolved',
    Skipped = 'Skipped',
    Pending = 'Pending'
}

export type YearEndPhase = {
    round: YearEndRound
    status: YearEndStatus
    results: Record<string, string[]>
}

export type YearEndReport = {
    key: string
    year: number | undefined
    phases: YearEndPhase[]
    endIndex: number | undefined
}

type YearEndAction = ReactSoil | RevealPlans | MoveCompost | EndYear

export function isYearEndAction(action: GameAction): action is YearEndAction {
    return (
        isReactSoil(action) ||
        isMoveCompost(action) ||
        isEndYear(action) ||
        (isRevealPlans(action) && action.step === MachineState.SpreadingCompost)
    )
}

function roundOf(action: YearEndAction): YearEndRound {
    if (isReactSoil(action)) return MachineState.SoilReacting
    if (isMoveCompost(action)) return MachineState.MovingCompost
    if (isEndYear(action)) return MachineState.EndingYear
    return MachineState.SpreadingCompost
}

function resultsOf(action: YearEndAction): Record<string, string[]> {
    if (isReactSoil(action)) {
        return Object.fromEntries(
            (action.metadata?.farms ?? []).map((farm) => [farm.playerId, soilParts(farm.changes)])
        )
    }
    if (isMoveCompost(action)) {
        return Object.fromEntries(
            (action.metadata?.moves ?? []).map((move) => [
                move.playerId,
                [`${move.worms} → ${move.ripened} worms`]
            ])
        )
    }
    if (isEndYear(action)) {
        return Object.fromEntries(
            (action.metadata?.settlements ?? []).map((settlement) => [
                settlement.playerId,
                settlementParts(settlement)
            ])
        )
    }
    return Object.fromEntries(
        (action.metadata?.outcomes ?? []).map((outcome) => [
            outcome.playerId,
            [
                ...compostParts(outcome),
                ...(outcome.cost > 0 ? [`paid ${marks(outcome.cost)}`] : []),
                ...(outcome.loansTaken > 0
                    ? [`borrowed ${marks(outcome.loansTaken * LOAN_AMOUNT)}`]
                    : [])
            ]
        ])
    )
}

export function latestYearEnd(
    actions: readonly GameAction[],
    years: readonly Round[]
): YearEndReport | undefined {
    const start = actions.findLastIndex((action) => isReactSoil(action))
    if (start < 0) {
        return undefined
    }
    const resolved = actions.slice(start).filter(isYearEndAction)
    const reached = resolved.map(roundOf)
    const furthest = Math.max(...reached.map((round) => YEAR_END_ROUNDS.indexOf(round)))
    const phases = YEAR_END_ROUNDS.map((round, index) => {
        const action = resolved.find((candidate) => roundOf(candidate) === round)
        return {
            round,
            status: action
                ? YearEndStatus.Resolved
                : index < furthest
                  ? YearEndStatus.Skipped
                  : YearEndStatus.Pending,
            results: action ? resultsOf(action) : {}
        }
    })
    return {
        key: actions[start].id,
        year: yearOf(actions[start].index, years),
        phases,
        endIndex: resolved.find((action) => isEndYear(action))?.index
    }
}
