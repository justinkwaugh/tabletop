import type { GameAction, Round, Turn } from '@tabletop/common'
import {
    ActionType,
    ROUNDS,
    isEndTurn,
    isThreatenAttack,
    roundLabel,
    type Scenario
} from '@tabletop/napoleons-triumph'

export interface HistoryLine {
    actionId: string
    index: number
    playerId?: string
    text: string
    /** Whether the action happened on the map, so that a picture of it can be opened. */
    pictured: boolean
}

export interface HistoryEntry extends HistoryLine {
    steps: HistoryLine[]
}

/** One side's turn within the hour; before the battle the actions belong to no turn and have no title. */
export interface HistoryTurn {
    start: number
    title?: string
    entries: HistoryEntry[]
}

export interface HistoryChapter {
    title: string
    turns: HistoryTurn[]
}

export interface HistoryContext {
    rounds: readonly Round[]
    turns: readonly Turn[]
    scenario: Scenario
    describe: (action: GameAction) => string
    turnTitle: (playerId: string) => string
}

const BEFORE_THE_BATTLE = 'Before the battle'

// Rule 17: the armies are bid for and chosen before a piece stands on the map.
const OFF_THE_MAP: readonly string[] = [
    ActionType.PlaceBid,
    ActionType.PassBid,
    ActionType.ChooseSide
]

// Rule 11: everything from the defender's answer to a threat until the attack is over is one attack.
const ATTACK_STEPS: readonly string[] = [
    ActionType.DeclareDefense,
    ActionType.Retreat,
    ActionType.DeclareFeint,
    ActionType.PressAttack,
    ActionType.LeadDefense,
    ActionType.DeclareAttack,
    ActionType.CounterAttack,
    ActionType.AssignLosses,
    ActionType.Regroup,
    ActionType.Advance,
    ActionType.Occupy
]

export function belongsToAnAttack(action: GameAction): boolean {
    return isThreatenAttack(action) || ATTACK_STEPS.includes(action.type)
}

// A round or turn is recorded as starting at the End turn that closed the one before, so the earlier one claims that action.
function spanOf<Span extends { start: number; end?: number }>(
    spans: readonly Span[],
    index: number
): Span | undefined {
    return spans.find((span) => span.start <= index && (span.end === undefined || index < span.end))
}

export function historyChapters(
    actions: readonly GameAction[],
    { rounds, turns, scenario, describe, turnTitle }: HistoryContext
): HistoryChapter[] {
    const chapters: HistoryChapter[] = []
    let attack: HistoryEntry | undefined
    actions.forEach((action, position) => {
        const continuesAttack = ATTACK_STEPS.includes(action.type)
        if (!continuesAttack) {
            attack = undefined
        }
        const index = action.index ?? position
        const round = spanOf(rounds, index)
        const turn = spanOf(turns, index)
        const text = isEndTurn(action) ? '' : describe(action)
        // A turn is headed even when nothing in it is told, so that its end shows.
        if (text === '' && turn === undefined) {
            return
        }
        const title = round
            ? roundLabel(ROUNDS[scenario][round.number - 1], true)
            : BEFORE_THE_BATTLE
        const openChapter = chapters.at(-1)
        const chapter = openChapter?.title === title ? openChapter : { title, turns: [] }
        if (chapter !== openChapter) {
            chapters.push(chapter)
        }
        const start = turn?.start ?? -1
        const openTurn = chapter.turns.at(-1)
        const section =
            openTurn?.start === start
                ? openTurn
                : {
                      start,
                      title: turn?.playerId === undefined ? undefined : turnTitle(turn.playerId),
                      entries: []
                  }
        if (section !== openTurn) {
            chapter.turns.push(section)
        }
        if (text === '') {
            return
        }
        const line = {
            actionId: action.id,
            index,
            playerId: action.playerId,
            text,
            pictured: !OFF_THE_MAP.includes(action.type)
        }
        if (continuesAttack && attack) {
            attack.steps.push(line)
            return
        }
        const entry = { ...line, steps: [] }
        section.entries.push(entry)
        attack = isThreatenAttack(action) ? entry : undefined
    })
    return chapters
}
