import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction, type Round, type Turn } from '@tabletop/common'
import { ActionType, Scenario } from '@tabletop/napoleons-triumph'
import { historyChapters, type HistoryChapter } from './historyChapters.js'

function action(index: number, type: ActionType, playerId: string): GameAction {
    return { id: `a${index}`, gameId: 'g', source: ActionSource.User, type, playerId, index }
}

const named = (entry: GameAction) => `${entry.type} ${entry.index}`

const SIDES: Record<string, string> = { p0: 'Allied', p1: 'French' }

function chaptersOf(
    actions: readonly GameAction[],
    rounds: readonly Round[],
    turns: readonly Turn[],
    describe: (action: GameAction) => string = named
): HistoryChapter[] {
    return historyChapters(actions, {
        rounds,
        turns,
        scenario: Scenario.December2,
        describe,
        turnTitle: (playerId) => `${SIDES[playerId]} turn`
    })
}

function entriesOf(chapter: HistoryChapter | undefined) {
    return chapter?.turns.flatMap((turn) => turn.entries) ?? []
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
    // As the game records them: a turn or round begins at the index of the End turn that closed the one before.
    const rounds = [
        { type: 'round', number: 1, start: 2, end: 5 },
        { type: 'round', number: 2, start: 4 }
    ]
    const turns = [
        { type: 'turn', playerId: 'p0', start: 2, end: 4 },
        { type: 'turn', playerId: 'p1', start: 3, end: 5 },
        { type: 'turn', playerId: 'p0', start: 4 }
    ]

    it('files each action under the round it was taken in, and within it under the turn', () => {
        const chapters = chaptersOf(actions, rounds, turns)
        expect(chapters.map((chapter) => chapter.title)).toEqual([
            'Before the battle',
            '2 December · 7:00AM',
            '2 December · 8:00AM'
        ])
        expect(
            chapters.map((chapter) =>
                chapter.turns.map((turn) => [turn.title, turn.entries.map((entry) => entry.index)])
            )
        ).toEqual([
            [[undefined, [0, 1]]],
            [
                ['Allied turn', [2]],
                ['French turn', []]
            ],
            [['Allied turn', [5]]]
        ])
        expect(entriesOf(chapters[1])[0]).toEqual({
            actionId: 'a2',
            index: 2,
            playerId: 'p0',
            text: 'Move 2',
            pictured: true,
            steps: []
        })
    })

    it('shows a turn that told nothing by its heading alone, and tells no End turn as a line', () => {
        const chapters = chaptersOf(actions, rounds, turns, (entry) =>
            entry.type === ActionType.DeployArmy ? named(entry) : ''
        )
        expect(chapters[1].turns.map((turn) => [turn.title, turn.entries])).toEqual([
            ['Allied turn', []],
            ['French turn', []]
        ])
    })

    it('drops actions that have nothing to tell outside a turn', () => {
        expect(chaptersOf(actions.slice(0, 2), rounds, turns, () => '')).toEqual([])
    })
})

describe('an attack in the history', () => {
    const rounds = [{ type: 'round', number: 1, start: 0 }]
    const turns = [{ type: 'turn', playerId: 'p0', start: 0 }]
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
        const [chapter] = chaptersOf(fought, rounds, turns)
        expect(entriesOf(chapter).map((entry) => entry.text)).toEqual([
            'Move 0',
            'ThreatenAttack 1',
            'Move 8'
        ])
        const [, attack] = entriesOf(chapter)
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
        const [chapter] = chaptersOf(fought.slice(0, 4), rounds, turns)
        expect(
            entriesOf(chapter)
                .at(-1)
                ?.steps.map((step) => step.index)
        ).toEqual([2, 3])
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
        const [chapter] = chaptersOf(ridingOn, rounds, turns)
        expect(entriesOf(chapter).map((entry) => entry.steps.map((step) => step.index))).toEqual([
            [1, 2],
            [4, 5, 6]
        ])
    })

    it('keeps a step whose opening threat told nothing as an entry of its own', () => {
        const told = (entry: GameAction) =>
            entry.type === ActionType.ThreatenAttack ? '' : named(entry)
        const [chapter] = chaptersOf(fought.slice(1, 3), rounds, turns, told)
        expect(entriesOf(chapter)).toHaveLength(1)
        expect(entriesOf(chapter)[0]).toMatchObject({ index: 2, steps: [] })
    })
})
