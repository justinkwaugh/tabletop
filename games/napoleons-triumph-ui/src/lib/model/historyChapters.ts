import type { GameAction, Round } from '@tabletop/common'
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

export interface HistoryChapter {
    title: string
    entries: HistoryEntry[]
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

export function historyChapters(
    actions: readonly GameAction[],
    rounds: readonly Round[],
    scenario: Scenario,
    describe: (action: GameAction) => string
): HistoryChapter[] {
    const chapters: HistoryChapter[] = []
    let attack: HistoryEntry | undefined
    actions.forEach((action, position) => {
        const continuesAttack = ATTACK_STEPS.includes(action.type)
        if (!continuesAttack) {
            attack = undefined
        }
        const text = isEndTurn(action) ? '' : describe(action)
        if (text === '') {
            return
        }
        const index = action.index ?? position
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
        const round = rounds.findLast((candidate) => candidate.start <= index)
        const title = round
            ? roundLabel(ROUNDS[scenario][round.number - 1], true)
            : BEFORE_THE_BATTLE
        const open = chapters.at(-1)
        const chapter = open?.title === title ? open : { title, entries: [] }
        if (chapter !== open) {
            chapters.push(chapter)
        }
        const entry = { ...line, steps: [] }
        chapter.entries.push(entry)
        attack = isThreatenAttack(action) ? entry : undefined
    })
    return chapters
}
