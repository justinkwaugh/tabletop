import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, Scenario } from '@tabletop/napoleons-triumph'
import { historyChapters } from './historyChapters.js'

function action(index: number, type: ActionType, playerId: string): GameAction {
    return { id: `a${index}`, gameId: 'g', source: ActionSource.User, type, playerId, index }
}

describe('history chapters', () => {
    const actions = [
        action(0, ActionType.DeployArmy, 'p0'),
        action(1, ActionType.DeployArmy, 'p1'),
        action(2, ActionType.Move, 'p0'),
        action(3, ActionType.EndTurn, 'p0'),
        action(4, ActionType.EndTurn, 'p1'),
        action(5, ActionType.Move, 'p0')
    ]
    const rounds = [
        { type: 'round', number: 1, start: 2, end: 5 },
        { type: 'round', number: 2, start: 5 }
    ]

    it('files each action under the round it was taken in and leaves out the ends of turns', () => {
        const chapters = historyChapters(
            actions,
            rounds,
            Scenario.December2,
            (entry) => `${entry.type} ${entry.index}`
        )
        expect(chapters.map((chapter) => chapter.title)).toEqual([
            'Before the battle',
            '2 December · 7:00AM',
            '2 December · 8:00AM'
        ])
        expect(chapters.map((chapter) => chapter.entries.map((entry) => entry.index))).toEqual([
            [0, 1],
            [2],
            [5]
        ])
        expect(chapters[1].entries[0]).toEqual({ index: 2, playerId: 'p0', text: 'Move 2' })
    })

    it('drops actions that have nothing to tell', () => {
        expect(historyChapters(actions, rounds, Scenario.December2, () => '')).toEqual([])
    })
})
