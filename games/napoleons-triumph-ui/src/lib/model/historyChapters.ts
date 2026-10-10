import type { GameAction, Round } from '@tabletop/common'
import { ROUNDS, isEndTurn, roundLabel, type Scenario } from '@tabletop/napoleons-triumph'

export interface HistoryEntry {
    index: number
    playerId?: string
    text: string
}

export interface HistoryChapter {
    title: string
    entries: HistoryEntry[]
}

const BEFORE_THE_BATTLE = 'Before the battle'

export function historyChapters(
    actions: readonly GameAction[],
    rounds: readonly Round[],
    scenario: Scenario,
    describe: (action: GameAction) => string
): HistoryChapter[] {
    const chapters: HistoryChapter[] = []
    actions.forEach((action, position) => {
        const index = action.index ?? position
        const round = rounds.findLast((candidate) => candidate.start <= index)
        const title = round
            ? roundLabel(ROUNDS[scenario][round.number - 1], true)
            : BEFORE_THE_BATTLE
        const text = isEndTurn(action) ? '' : describe(action)
        if (text === '') {
            return
        }
        const open = chapters.at(-1)
        const chapter = open?.title === title ? open : { title, entries: [] }
        if (chapter !== open) {
            chapters.push(chapter)
        }
        chapter.entries.push({ index, playerId: action.playerId, text })
    })
    return chapters
}
