import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction,
    type GameAction,
    type Round,
    type Turn
} from '@tabletop/common'
import { ActionType, Scenario, Side } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { chaptersInOrder, historyChapters, type HistoryChapter } from './historyChapters.js'

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
        expect(chaptersOf(actions.slice(0, 2), [], [], () => '')).toEqual([])
    })

    it('tells a called game on its own, under no turn, and heads no turn in play after it', () => {
        const call: CallGameAction = {
            id: 'a6',
            gameId: 'g',
            source: ActionSource.System,
            type: CALL_GAME_ACTION_TYPE,
            index: 6,
            call: {
                kind: GameCallKind.Conceded,
                initiatorPlayerId: 'p0',
                declaredWinnerId: 'p1',
                approvingPlayerIds: ['p0'],
                decliningPlayerIds: []
            }
        }
        const chapters = chaptersOf([...actions, call], rounds, turns)
        expect(chapters.at(-1)?.turns.map((turn) => [turn.title, turn.entries])).toEqual([
            ['Allied turn', [expect.objectContaining({ index: 5 })]],
            [
                undefined,
                [
                    {
                        actionId: 'a6',
                        index: 6,
                        playerId: undefined,
                        text: 'callGame 6',
                        pictured: false,
                        steps: []
                    }
                ]
            ]
        ])
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

describe('turns as the game records them', () => {
    const game = new TestGame()
    const actions: GameAction[] = []
    const act = (type: ActionType, side: Side) =>
        actions.push(...game.act(type, game.playerOf(side)))
    actions.push(...game.deploy(Side.Allied), ...game.deploy(Side.French))

    function headings() {
        const sides: Record<string, string> = {
            [game.playerOf(Side.Allied)]: 'Allied',
            [game.playerOf(Side.French)]: 'French'
        }
        return historyChapters(actions, {
            rounds: game.state.rounds.series,
            turns: game.state.turnManager.series,
            scenario: game.state.scenario,
            describe: named,
            turnTitle: (playerId) => `${sides[playerId]} turn`
        }).map((chapter) => [chapter.title, chapter.turns.map((turn) => turn.title)])
    }

    it('heads the turn in play as soon as the one before it ends, before anything is done in it', () => {
        expect(headings().at(-1)).toEqual(['2 December · 7:00AM', ['Allied turn']])
        act(ActionType.EndTurn, Side.Allied)
        expect(headings().at(-1)).toEqual(['2 December · 7:00AM', ['Allied turn', 'French turn']])
        act(ActionType.EndTurn, Side.French)
        expect(headings().slice(1)).toEqual([
            ['2 December · 7:00AM', ['Allied turn', 'French turn']],
            ['2 December · 8:00AM', ['Allied turn']]
        ])
    })
})

describe('the order of the history', () => {
    const line = (index: number) => ({
        actionId: `a${index}`,
        index,
        text: `${index}`,
        pictured: false
    })
    const chapters: HistoryChapter[] = [
        {
            title: '7:00AM',
            turns: [
                {
                    playerId: 'p1',
                    title: 'French turn',
                    entries: [
                        { ...line(0), steps: [] },
                        { ...line(1), steps: [line(2), line(3)] }
                    ]
                },
                { playerId: 'p2', title: 'Allies’ turn', entries: [{ ...line(4), steps: [] }] }
            ]
        },
        {
            title: '8:00AM',
            turns: [{ playerId: 'p1', title: 'French turn', entries: [{ ...line(5), steps: [] }] }]
        }
    ]
    const told = (ordered: HistoryChapter[]) =>
        ordered.flatMap((chapter) => [
            chapter.title,
            ...chapter.turns.flatMap((turn) => [
                turn.title,
                ...turn.entries.flatMap((entry) => [
                    entry.text,
                    ...entry.steps.map((step) => step.text)
                ])
            ])
        ])

    it('runs oldest to newest when the newest is last', () => {
        expect(told(chaptersInOrder(chapters, 'newestLast'))).toEqual([
            '7:00AM',
            'French turn',
            '0',
            '1',
            '2',
            '3',
            'Allies’ turn',
            '4',
            '8:00AM',
            'French turn',
            '5'
        ])
    })

    it('runs newest to oldest when the newest is first, each line still followed by its steps in order', () => {
        expect(told(chaptersInOrder(chapters, 'newestFirst'))).toEqual([
            '8:00AM',
            'French turn',
            '5',
            '7:00AM',
            'Allies’ turn',
            '4',
            'French turn',
            '1',
            '2',
            '3',
            '0'
        ])
    })
})
