import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, Scenario } from '@tabletop/napoleons-triumph'
import { historyChapters } from './historyChapters.js'

function action(index: number, type: ActionType, playerId: string): GameAction {
    return { id: `a${index}`, gameId: 'g', source: ActionSource.User, type, playerId, index }
}

const named = (entry: GameAction) => `${entry.type} ${entry.index}`

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
        const chapters = historyChapters(actions, rounds, Scenario.December2, named)
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
        expect(chapters[1].entries[0]).toEqual({
            actionId: 'a2',
            index: 2,
            playerId: 'p0',
            text: 'Move 2',
            steps: []
        })
    })

    it('drops actions that have nothing to tell', () => {
        expect(historyChapters(actions, rounds, Scenario.December2, () => '')).toEqual([])
    })
})

describe('an attack in the history', () => {
    const rounds = [{ type: 'round', number: 1, start: 0 }]
    const fought = [
        action(0, ActionType.Move, 'p0'),
        action(1, ActionType.ThreatenAttack, 'p0'),
        action(2, ActionType.DeclareDefense, 'p1'),
        action(3, ActionType.PressAttack, 'p0'),
        action(4, ActionType.DeclareAttack, 'p0'),
        action(5, ActionType.CounterAttack, 'p1'),
        action(6, ActionType.AssignLosses, 'p1'),
        action(7, ActionType.Retreat, 'p1'),
        action(8, ActionType.Move, 'p0')
    ]

    it('is one entry, opened by the threat, that takes each step of the attack as it comes', () => {
        const [chapter] = historyChapters(fought, rounds, Scenario.December2, named)
        expect(chapter.entries.map((entry) => entry.text)).toEqual([
            'Move 0',
            'ThreatenAttack 1',
            'Move 8'
        ])
        const [, attack] = chapter.entries
        expect(attack.steps.map((step) => step.index)).toEqual([2, 3, 4, 5, 6, 7])
        expect(attack.steps.map((step) => step.playerId)).toEqual([
            'p1',
            'p0',
            'p0',
            'p1',
            'p1',
            'p1'
        ])
    })

    it('grows while the attack is still going on', () => {
        const [chapter] = historyChapters(fought.slice(0, 4), rounds, Scenario.December2, named)
        expect(chapter.entries.at(-1)?.steps.map((step) => step.index)).toEqual([2, 3])
    })

    it('is closed by the next threat, which opens an attack of its own', () => {
        const ridingOn = [
            action(0, ActionType.ThreatenAttack, 'p0'),
            action(1, ActionType.Retreat, 'p1'),
            action(2, ActionType.Occupy, 'p0'),
            action(3, ActionType.ThreatenAttack, 'p0'),
            action(4, ActionType.DeclareDefense, 'p1'),
            action(5, ActionType.DeclareFeint, 'p0'),
            action(6, ActionType.Advance, 'p1')
        ]
        const [chapter] = historyChapters(ridingOn, rounds, Scenario.December2, named)
        expect(chapter.entries.map((entry) => entry.steps.map((step) => step.index))).toEqual([
            [1, 2],
            [4, 5, 6]
        ])
    })

    it('keeps a step whose opening threat told nothing as an entry of its own', () => {
        const told = (entry: GameAction) =>
            entry.type === ActionType.ThreatenAttack ? '' : named(entry)
        const [chapter] = historyChapters(fought.slice(1, 3), rounds, Scenario.December2, told)
        expect(chapter.entries).toHaveLength(1)
        expect(chapter.entries[0]).toMatchObject({ index: 2, steps: [] })
    })
})
