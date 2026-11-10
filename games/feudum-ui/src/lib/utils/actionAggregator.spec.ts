import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    assertExists,
    createStalledGameAction,
    isCallGameAction,
    type GameAction,
    type Round
} from '@tabletop/common'
import {
    ActionType,
    MachineState,
    isAdvanceTurn,
    isEndRound,
    isStartRound,
    RoyalWrits,
    type FeudumGameState
} from '@tabletop/feudum'
import {
    perspectivesOf,
    processedOf,
    realGames,
    recordFor,
    Spectator,
    transitionsOf,
    writsNamedIn
} from '@tabletop/feudum/testing'
import { describeAction } from '$lib/model/actionDescription.js'
import {
    aggregateHistory,
    isHistoryGroup,
    linedActions,
    type HistoryEntry,
    type HistoryGroup,
    type HistoryGroupKind,
    type HistoryTable
} from './actionAggregator.js'
import source from './actionAggregator.ts?raw'

const [P1, P2, P3] = ['p1', 'p2', 'p3']
type GameWalk = ReturnType<typeof realGames>[number]

const Table: HistoryTable = { rounds: [], epoch: 1, seats: 3 }

/** An Action as a seat receives it: the fields grouping may read and nothing else. */
function act(index: number, type: string, playerId?: string, metadata?: unknown): GameAction {
    return {
        id: `action-${index}`,
        gameId: 'game',
        source: playerId ? ActionSource.User : ActionSource.System,
        type,
        index,
        ...(playerId ? { playerId } : {}),
        ...(metadata ? { metadata } : {})
    }
}

function round(number: number, start: number, end?: number): Round {
    return { type: 'round', number, start, ...(end === undefined ? {} : { end }) }
}

function groupsOf(entries: readonly HistoryEntry[]): HistoryGroup[] {
    return entries.filter(isHistoryGroup)
}

/** `kind first-last`, the shape every table below states by hand. */
function spans(entries: readonly HistoryEntry[]): string[] {
    return groupsOf(entries).map(
        ({ kind, firstIndex, lastIndex }) => `${kind} ${firstIndex}-${lastIndex}`
    )
}

function typesIn(group: HistoryGroup): string[] {
    return group.actions.map(({ type }) => type)
}

function onlyGroup(actions: readonly GameAction[], table = Table): HistoryGroup {
    const groups = groupsOf(aggregateHistory(actions, table))
    expect(groups).toHaveLength(1)
    return groups[0]
}

/** R-3.1 Three finalisers from `start`, so what follows is the first turn. */
function selection(start: number): GameAction[] {
    return [
        act(start, ActionType.StartRound),
        act(start + 1, ActionType.FinaliseHand, P1),
        act(start + 2, ActionType.FinaliseHand, P2),
        act(start + 3, ActionType.FinaliseHand, P3)
    ]
}

describe('R-1.4 Setup', () => {
    it('R-1.4 Each seat`s setup Action is its own entry, with nothing to jump to or replay', () => {
        const entries = aggregateHistory(
            [
                act(0, ActionType.ChooseStartingGoods, P1),
                act(1, ActionType.ChooseStartingGoods, P2),
                act(2, ActionType.PlaceStartingPawn, P1)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['single 0-0', 'single 1-1', 'single 2-2'])
        for (const group of groupsOf(entries)) {
            expect(group.replays).toBe(false)
            expect(group.jumpIndex).toBeUndefined()
        }
    })

    it('R-1.4 Setup never holds an entry open for the next Action', () => {
        expect(
            spans(
                aggregateHistory(
                    [act(0, ActionType.PlaceStartingPawn, P1), act(1, ActionType.DiscardWrit, P1)],
                    Table
                )
            )
        ).toEqual(['single 0-0', 'turn 1-1'])
    })
})

describe('R-3.1 One entry per hand selection', () => {
    it('R-3.1 It holds a line per finaliser and StartRound isn`t one', () => {
        const hands = onlyGroup(selection(6))

        expect(hands.kind).toBe('hands')
        expect(hands.actions.map(({ playerId }) => playerId)).toEqual([P1, P2, P3])
        expect([hands.firstIndex, hands.lastIndex]).toEqual([7, 9])
        expect(hands.replays).toBe(false)
        expect(hands.jumpIndex).toBeUndefined()
    })

    it('R-4.4-H1 An at-will Action played while hands are chosen stays in the selection', () => {
        const hands = onlyGroup([
            ...selection(6).slice(0, 2),
            act(8, ActionType.PlayMandate, P2),
            act(9, ActionType.FinaliseHand, P2),
            act(10, ActionType.FinaliseHand, P3)
        ])

        expect(hands.kind).toBe('hands')
        expect([hands.firstIndex, hands.lastIndex]).toEqual([7, 10])
    })

    it('R-3.1 An at-will Action before any finaliser is the selection`s too', () => {
        const entries = aggregateHistory(
            [
                act(6, ActionType.StartRound),
                act(7, ActionType.DiscardWrit, P1),
                act(8, ActionType.FinaliseHand, P1),
                act(9, ActionType.FinaliseHand, P2),
                act(10, ActionType.FinaliseHand, P3)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['hands 7-10'])
    })

    it('R-3.2 The selection ends on the last seat`s finaliser: what follows is the first turn', () => {
        const entries = aggregateHistory(
            [...selection(6), act(10, ActionType.DiscardWrit, P1), act(11, ActionType.Move, P1)],
            Table
        )

        expect(spans(entries)).toEqual(['hands 7-9', 'turn 10-11'])
    })

    it('R-3.1 The seat count is the table`s: two seats end it on the second finaliser', () => {
        const entries = aggregateHistory(
            [
                act(6, ActionType.StartRound),
                act(7, ActionType.FinaliseHand, P1),
                act(8, ActionType.FinaliseHand, P2),
                act(9, ActionType.Move, P1)
            ],
            { ...Table, seats: 2 }
        )

        expect(spans(entries)).toEqual(['hands 7-8', 'turn 9-9'])
    })
})

describe('R-3.2 One entry per turn, growing', () => {
    const start = selection(6)

    it.each([
        {
            name: 'R-3.3 a second card',
            actions: [act(10, ActionType.Move, P1), act(11, ActionType.Tax, P1)]
        },
        {
            name: 'R-4.6 a guild function and the follow-ups it asks',
            actions: [
                act(10, ActionType.GuildAction, P1),
                act(11, ActionType.KeepWrits, P1),
                act(12, ActionType.PlaceDisc, P1)
            ]
        },
        {
            name: 'R-3.14.1 an attack, the other seat`s answer and the commit',
            actions: [
                act(10, ActionType.Conquer, P1),
                act(11, ActionType.AnswerAttack, P2),
                act(12, ActionType.CommitAttack, P1)
            ]
        },
        {
            name: 'R-3.14.2 a starving and the other seat`s answer',
            actions: [act(10, ActionType.StarveThePeople, P1), act(11, ActionType.AnswerStarve, P2)]
        },
        {
            name: 'R-4.4-H1 at-will Actions before and after the card',
            actions: [
                act(10, ActionType.PlayMandate, P1),
                act(11, ActionType.Move, P1),
                act(12, ActionType.DiscardWrit, P1)
            ]
        }
    ])('$name stay one entry at every point of the turn', ({ actions }) => {
        const ids = new Set<string>()
        for (let length = 1; length <= actions.length; length++) {
            const held = actions.slice(0, length)
            const turn = groupsOf(aggregateHistory([...start, ...held], Table)).at(-1)
            expect(turn?.kind).toBe('turn')
            expect(turn?.actions).toEqual(held)
            expect(turn?.playerId).toBe(P1)
            expect(turn?.firstIndex).toBe(10)
            ids.add(turn?.id ?? '')
        }
        // The id holds still, so the row in the list doesn't restart as it grows.
        expect([...ids]).toEqual(['turn-10'])
    })

    it.each(['second-card', 'writ-limit'])(
        'R-3.3-H1, R-4.4.4 An AdvanceTurn with outcome %s leaves the turn open, and is in no entry',
        (outcome) => {
            const entries = aggregateHistory(
                [
                    ...start,
                    act(10, ActionType.Move, P1),
                    act(11, ActionType.AdvanceTurn, undefined, { outcome, turnPlayerId: P1 }),
                    act(12, ActionType.DiscardWrit, P1),
                    act(13, ActionType.AdvanceTurn, undefined, {
                        outcome: 'next-seat',
                        turnPlayerId: P2
                    }),
                    act(14, ActionType.Tax, P2)
                ],
                Table
            )

            expect(spans(entries)).toEqual(['hands 7-9', 'turn 10-12', 'turn 14-14'])
            expect(typesIn(groupsOf(entries)[1])).toEqual([ActionType.Move, ActionType.DiscardWrit])
        }
    )

    it('R-3.2 The last card`s AdvanceTurn ends the turn too', () => {
        const entries = aggregateHistory(
            [
                ...start,
                act(10, ActionType.Move, P1),
                act(11, ActionType.AdvanceTurn, undefined, { outcome: 'last-card' }),
                act(12, ActionType.NourishPawns, undefined, { fed: [] })
            ],
            Table
        )

        expect(spans(entries)).toEqual(['hands 7-9', 'turn 10-10', 'nourishing 12-12'])
    })

    it('R-3.2 AdvanceTurn ends the turn, and neither it nor StartRound is in any entry', () => {
        const entries = aggregateHistory(
            [
                ...start,
                act(10, ActionType.Move, P1),
                act(11, ActionType.AdvanceTurn),
                act(12, ActionType.Tax, P2),
                act(13, ActionType.AdvanceTurn)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['hands 7-9', 'turn 10-10', 'turn 12-12'])
        const held = groupsOf(entries).flatMap(typesIn)
        expect(held).not.toContain(ActionType.AdvanceTurn)
        expect(held).not.toContain(ActionType.StartRound)
    })

    it('R-3.2 A turn belongs to the seat whose turn it is, not the seat that answered', () => {
        const turn = groupsOf(
            aggregateHistory(
                [...start, act(10, ActionType.Conquer, P2), act(11, ActionType.AnswerAttack, P3)],
                Table
            )
        ).at(-1)

        expect(turn?.playerId).toBe(P2)
    })

    it('Only a turn names a seat', () => {
        expect(onlyGroup(selection(6)).playerId).toBeUndefined()
    })

    it('A called game sits beside the table and doesn`t split the turn', () => {
        const called = createStalledGameAction({ gameId: 'game', index: 11 })
        const entries = aggregateHistory(
            [...start, act(10, ActionType.Move, P1), called, act(12, ActionType.Tax, P1)],
            Table
        )

        expect(isCallGameAction(called)).toBe(true)
        expect(spans(entries)).toEqual(['hands 7-9', 'turn 10-12', 'single 11-11'])
    })
})

describe('R-4.10, R-4.11, R-4.12 The end of a round', () => {
    const Rolled = { faces: ['a'] }

    it('R-4.10 Nourishing holds the pawns` feeding and each seat`s, with at-will Actions', () => {
        const entries = aggregateHistory(
            [
                act(30, ActionType.AdvanceTurn),
                act(31, ActionType.NourishPawns, undefined, { fed: [] }),
                act(32, ActionType.Nourish, P2, { returned: [] }),
                act(33, ActionType.DiscardWrit, P3),
                act(34, ActionType.Nourish, P3, { returned: [] })
            ],
            Table
        )

        expect(spans(entries)).toEqual(['nourishing 31-34'])
    })

    it('R-4.10 "No pawn needed feeding" reads only when no seat in the entry fed or lost a pawn', () => {
        const NobodyFed = 'No pawn needed feeding'
        const linesOf = (group: HistoryGroup) =>
            linedActions(group).map((action) =>
                describeAction(action, { viewerId: P1, nameOf: String })
            )
        const gameFedNobody = act(30, ActionType.NourishPawns, undefined, { fed: [] })
        const seatFed: GameAction = {
            ...act(31, ActionType.Nourish, P2, { foodFed: [], returned: [] }),
            wineFed: [1]
        }
        const seatLost: GameAction = {
            ...act(31, ActionType.Nourish, P2, {
                foodFed: [],
                returned: [{ n: 1, left: { character: 'merchant', spaceId: 'space.sea.1' } }]
            }),
            wineFed: []
        }

        for (const seat of [seatFed, seatLost]) {
            const group = onlyGroup([gameFedNobody, seat])
            expect(linesOf(group)).not.toContain(NobodyFed)
            expect(linesOf(group)).toHaveLength(1)
            expect(typesIn(group)).toEqual([ActionType.NourishPawns, ActionType.Nourish])
        }
        expect(linesOf(onlyGroup([gameFedNobody]))).toEqual([NobodyFed])
    })

    it.each([
        [ActionType.Nourish, 'nourishing', { returned: [] }],
        [ActionType.ReplenishMap, 'dawn', undefined],
        [ActionType.ReplenishGuilds, 'dawn', undefined],
        [ActionType.CollectLandscapes, 'dawn', undefined]
    ])(
        'R-4.10, R-4.12 %s belongs to its own entry, whatever stands before it',
        (type, kind, metadata) => {
            const entries = aggregateHistory(
                [
                    act(30, ActionType.Move, P1),
                    act(31, ActionType.AdvanceTurn),
                    act(32, type, P2, metadata)
                ],
                Table
            )

            expect(spans(entries)).toEqual(['turn 30-30', `${kind} 32-32`])
        }
    )

    it('R-4.11.1 The roll is its own entry; with no dawn the round`s end folds into it', () => {
        const entries = aggregateHistory(
            [
                act(30, ActionType.NourishPawns, undefined, { fed: [] }),
                act(31, ActionType.RollProgressDie, undefined, Rolled),
                act(32, ActionType.EndRound),
                act(33, ActionType.StartRound)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['nourishing 30-30', 'progress 31-32'])
        expect(typesIn(groupsOf(entries)[1])).toEqual([
            ActionType.RollProgressDie,
            ActionType.EndRound
        ])
    })

    it('R-4.12 A dawn holds its own steps and takes the round`s end', () => {
        const entries = aggregateHistory(
            [
                act(30, ActionType.RollProgressDie, undefined, Rolled),
                act(31, ActionType.BeginDawn, undefined, { epoch: 2 }),
                act(32, ActionType.ReplenishMap),
                act(33, ActionType.ReplenishGuilds),
                act(34, ActionType.CollectLandscapes, P1),
                act(35, ActionType.EndRound),
                act(36, ActionType.StartRound)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['progress 30-30', 'dawn 31-35'])
    })

    it('R-2.2 EndRound folds back into the last entry if nothing is open', () => {
        const entries = aggregateHistory(
            [
                act(30, ActionType.Move, P1),
                act(31, ActionType.AdvanceTurn),
                act(32, ActionType.EndRound)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['turn 30-32'])
    })

    it('R-2.2 An EndRound alone in a window still has an entry, not a lost line', () => {
        expect(spans(aggregateHistory([act(30, ActionType.EndRound)], Table))).toEqual([
            'single 30-30'
        ])
    })

    it('R-6.2 Final scoring is its own entry, after the last round`s', () => {
        const entries = aggregateHistory(
            [
                act(30, ActionType.BeginDawn, undefined, { epoch: 5 }),
                act(31, ActionType.EndRound),
                act(32, ActionType.ScoreGame)
            ],
            Table
        )

        expect(spans(entries)).toEqual(['dawn 30-31', 'single 32-32'])
    })
})

describe('R-2.1, R-2.2 Interstitials', () => {
    function dividersOf(entries: readonly HistoryEntry[]) {
        return entries.flatMap((entry, position) =>
            isHistoryGroup(entry) ? [] : [{ entry, position }]
        )
    }

    it('R-2.2 A round`s comes from the round manager, at its start, not from the Actions', () => {
        const actions = [
            ...selection(6),
            act(10, ActionType.Move, P1),
            act(11, ActionType.EndRound),
            ...selection(12)
        ]
        const entries = aggregateHistory(actions, {
            ...Table,
            rounds: [round(1, 6, 12), round(2, 12)]
        })

        expect(entries.map(({ id }) => id)).toEqual([
            'epoch-1',
            'round-1',
            'hands-7',
            'turn-10',
            'round-2',
            'hands-13'
        ])
    })

    it('R-2.2 The number shown is the series`, whatever else is around it', () => {
        const entries = aggregateHistory(selection(6), { ...Table, rounds: [round(7, 6)] })

        expect(entries.find(({ kind }) => kind === 'round')).toEqual({
            kind: 'round',
            id: 'round-7',
            round: 7,
            jumpIndex: 6
        })
    })

    it('R-2.2 A round started before the first Action known has no interstitial', () => {
        const entries = aggregateHistory([act(20, ActionType.Move, P1), ...selection(21)], {
            ...Table,
            rounds: [round(1, 6, 21), round(2, 21)]
        })

        expect(dividersOf(entries).map(({ entry }) => entry.id)).toEqual(['epoch-1', 'round-2'])
    })

    it('R-2.1 The opening epoch is the state`s while no dawn has come', () => {
        const entries = aggregateHistory([act(10, ActionType.Move, P1)], { ...Table, epoch: 3 })

        expect(dividersOf(entries).map(({ entry }) => entry.id)).toEqual(['epoch-3'])
    })

    it('R-4.11.2 Each dawn opens its epoch, before its own entry; the opening epoch is the one before', () => {
        const entries = aggregateHistory(
            [
                act(30, ActionType.Move, P1),
                act(31, ActionType.BeginDawn, undefined, { epoch: 3 }),
                act(32, ActionType.EndRound),
                act(33, ActionType.Move, P1),
                act(34, ActionType.BeginDawn, undefined, { epoch: 4 })
            ],
            // The state's epoch is the latest; the list opens on the first the Actions show.
            { ...Table, epoch: 4 }
        )

        expect(entries.map(({ id }) => id)).toEqual([
            'epoch-2',
            'turn-30',
            'epoch-3',
            'dawn-31',
            'turn-33',
            'epoch-4',
            'dawn-34'
        ])
    })
})

describe('R-2.2 Jump', () => {
    it('R-2.2 A round jumps to its start, where it began', () => {
        const entries = aggregateHistory(selection(37), { ...Table, rounds: [round(2, 37)] })

        expect(entries.find(({ kind }) => kind === 'round')).toMatchObject({ jumpIndex: 37 })
    })

    it('R-3.2 A turn jumps to its last Action, as it ended', () => {
        const turn = onlyGroup([
            act(10, ActionType.Conquer, P1),
            act(11, ActionType.AnswerAttack, P2),
            act(12, ActionType.CommitAttack, P1)
        ])

        expect(turn.jumpIndex).toBe(12)
    })

    it('R-4.12 A dawn jumps to the round`s end it took, as it ended', () => {
        const dawn = onlyGroup([
            act(30, ActionType.BeginDawn, undefined, { epoch: 2 }),
            act(31, ActionType.ReplenishMap),
            act(32, ActionType.EndRound)
        ])

        expect(dawn.jumpIndex).toBe(32)
    })

    it.each([
        ['hands', ActionType.FinaliseHand],
        ['nourishing', ActionType.NourishPawns],
        ['progress', ActionType.RollProgressDie],
        ['single', ActionType.PlaceStartingPawn]
    ])('Contract names no jump on %s', (kind, type) => {
        const group = onlyGroup([act(10, type, P1, { fed: [], faces: [] })])

        expect(group.kind).toBe(kind)
        expect(group.jumpIndex).toBeUndefined()
    })
})

describe('R-2.2 Replay', () => {
    it.each([
        ['R-3.6', ActionType.Migrate],
        ['R-3.7', ActionType.Move],
        ['R-3.8', ActionType.Influence],
        ['R-3.9', ActionType.Improve],
        ['R-4.3.4', ActionType.TendLandscape],
        ['R-3.11', ActionType.Harvest],
        ['R-3.13', ActionType.Conquer],
        ['R-3.14.2', ActionType.StarveThePeople],
        ['R-3.16', ActionType.GuildAction],
        ['R-4.6', ActionType.Feast]
    ])('%s A turn with %s replays', (_rule, type) => {
        expect(onlyGroup([act(10, type, P1)]).replays).toBe(true)
    })

    it.each([
        ['R-3.12', ActionType.Tax],
        ['R-3.10', ActionType.Explore],
        ['R-3.14', ActionType.PlayDefend],
        ['R-3.2', ActionType.ForfeitCard],
        ['R-4.4-H1', ActionType.PlayMandate],
        ['R-4.4-H1', ActionType.DiscardWrit],
        ['R-4.4', ActionType.KeepWrits],
        ['R-4.5', ActionType.PlaceDisc]
    ])('%s A turn with only %s does not', (_rule, type) => {
        expect(onlyGroup([act(10, type, P1)]).replays).toBe(false)
    })

    it('R-3.3 One listed Action anywhere in the turn is enough, and the span is the whole turn', () => {
        const turn = onlyGroup([
            act(10, ActionType.Tax, P1),
            act(11, ActionType.Move, P1),
            act(12, ActionType.DiscardWrit, P1)
        ])

        expect(turn.replays).toBe(true)
        expect([turn.firstIndex, turn.lastIndex]).toEqual([10, 12])
    })

    it('R-4.11.1 A progress roll replays, across the round`s end it took', () => {
        const progress = onlyGroup([
            act(30, ActionType.RollProgressDie, undefined, { faces: ['a'] }),
            act(31, ActionType.EndRound)
        ])

        expect(progress.replays).toBe(true)
        expect([progress.firstIndex, progress.lastIndex]).toEqual([30, 31])
    })

    it('R-4.11.1 A die that wasn`t rolled has nothing to replay', () => {
        expect(
            onlyGroup([act(30, ActionType.RollProgressDie, undefined, { faces: [] })]).replays
        ).toBe(false)
    })

    it('R-4.10 Nourishing replays when a seat`s choice left a pawn unfed', () => {
        const left = { n: 1, left: {} }
        expect(
            onlyGroup([
                act(30, ActionType.NourishPawns, undefined, { fed: [] }),
                act(31, ActionType.Nourish, P1, { returned: [left] })
            ]).replays
        ).toBe(true)
    })

    it('R-4.10 Nourishing replays when the pawns` feeding left one unfed', () => {
        expect(
            onlyGroup([
                act(30, ActionType.NourishPawns, undefined, {
                    fed: [{ playerId: P1, returned: [{ n: 1, left: {} }] }]
                })
            ]).replays
        ).toBe(true)
    })

    it('R-4.10 Nourishing with every pawn fed does not', () => {
        expect(
            onlyGroup([
                act(30, ActionType.NourishPawns, undefined, {
                    fed: [{ playerId: P1, returned: [] }]
                }),
                act(31, ActionType.Nourish, P2, { returned: [] })
            ]).replays
        ).toBe(false)
    })

    it('R-4.12 A dawn always does', () => {
        expect(onlyGroup([act(30, ActionType.ReplenishMap)]).replays).toBe(true)
    })

    it('R-3.1 A hand selection and setup do not', () => {
        expect(onlyGroup(selection(6)).replays).toBe(false)
        expect(onlyGroup([act(0, ActionType.PlaceStartingPawn, P1)]).replays).toBe(false)
    })
})

function deepFrozen<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(deepFrozen)
        Object.freeze(value)
    }
    return value
}

describe('R-5-H1 Pure: only what the seat received', () => {
    const actions = deepFrozen([
        ...selection(6),
        act(10, ActionType.Move, P1),
        act(11, ActionType.AdvanceTurn),
        act(12, ActionType.EndRound)
    ])
    const table = deepFrozen({ ...Table, rounds: [round(1, 6, 13)] })

    it('It changes nothing it is given and answers the same twice', () => {
        const first = aggregateHistory(actions, table)

        expect(aggregateHistory(actions, table)).toEqual(first)
    })

    it('It hands on the Actions it received, not copies', () => {
        const turn = groupsOf(aggregateHistory(actions, table)).find(({ kind }) => kind === 'turn')

        expect(turn?.actions[0]).toBe(actions[4])
    })

    it('Nothing it could read says more than the Actions: the module names no patch and no state', () => {
        expect(source).not.toMatch(
            /undoPatch|forwardPatch|gameState|session|Date\.now|Math\.random|nanoid|crypto/
        )
    })

    it('Nothing it adds is taken from an Action but its index, player and type', () => {
        const [group] = groupsOf(aggregateHistory([act(10, ActionType.Move, P1)], Table))

        expect(Object.keys(group).toSorted()).toEqual([
            'actions',
            'firstIndex',
            'id',
            'jumpIndex',
            'kind',
            'lastIndex',
            'playerId',
            'replays'
        ])
    })
})

/** Oldest to newest, as played: the state says what each Action belonged to. */
function kindByState(state: FeudumGameState): HistoryGroupKind {
    switch (state.machineState) {
        case MachineState.ChoosingStartingGoods:
        case MachineState.PlacingStartingPawn:
        case MachineState.EndOfRound:
        case MachineState.EndOfGame:
            return 'single'
        case MachineState.SelectingHands:
            return 'hands'
        case MachineState.Nourishing:
            return 'nourishing'
        case MachineState.ProgressRoll:
            return 'progress'
        case MachineState.Dawn:
        case MachineState.Replenishing:
        case MachineState.CollectingLandscapes:
            return 'dawn'
        default:
            return 'turn'
    }
}

function tableOf(walk: GameWalk): HistoryTable {
    const last = walk.steps.at(-1)?.after.at(-1)
    return {
        rounds: last?.roundManager.series ?? [],
        epoch: 1,
        seats: walk.game.players.length
    }
}

function writWords(writId: string): string {
    const writ = RoyalWrits.find(({ id }) => id === writId)
    assertExists(writ, 'A writ the deck holds')
    return 'number' in writ ? `Mandate ${writ.number}` : writ.text
}

function viewersOf(walk: GameWalk) {
    return perspectivesOf(walk).map((perspective) => ({
        perspective,
        viewerId: perspective.kind === 'player' ? perspective.playerId : undefined
    }))
}

describe('R-5-H1 Whole games, from every seat and a spectator', () => {
    const walks = realGames()

    it.each(walks.map((walk) => ({ walk, seats: walk.game.players.length })))(
        '$seats seats: every Action once but those skipped, the same for every eye',
        ({ walk }) => {
            const processed = processedOf(walk)
            const shape = spans(aggregateHistory(processed, tableOf(walk)))
            for (const { perspective } of viewersOf(walk)) {
                const received = processed.map((action) => recordFor(action, perspective, walk))
                const entries = aggregateHistory(received, tableOf(walk))

                expect(spans(entries)).toEqual(shape)
                const held = groupsOf(entries).flatMap(({ actions }) => actions)
                expect(
                    held.map(({ index }) => index).toSorted((a, b) => (a ?? 0) - (b ?? 0))
                ).toEqual(
                    processed
                        .filter((action) => !isAdvanceTurn(action) && !isStartRound(action))
                        .map(({ index }) => index)
                )
                for (const action of held) {
                    // The very record this seat received: an entry can say no more than it does.
                    expect(received).toContain(action)
                }
            }
        }
    )

    it.each(walks.map((walk) => ({ walk, seats: walk.game.players.length })))(
        '$seats seats: the state each Action was played in agrees with its entry',
        ({ walk }) => {
            const entries = aggregateHistory(processedOf(walk), tableOf(walk))
            const groupOf = new Map(
                groupsOf(entries).flatMap((group) =>
                    group.actions.map((action) => [action.id, group] as const)
                )
            )
            for (const { action, before } of transitionsOf(walk)) {
                if (isAdvanceTurn(action) || isStartRound(action) || isEndRound(action)) {
                    continue
                }
                const group = groupOf.get(action.id)
                expect(group?.kind, `${action.type} ${action.index}`).toBe(kindByState(before))
                if (group?.kind === 'turn' && action.playerId) {
                    expect(group.playerId, `${action.type} ${action.index}`).toBe(
                        before.flow.turn?.playerId
                    )
                }
            }
        }
    )

    it('R-3.2 In the whole games, a turn`s next-seat AdvanceTurn always ends its entry', () => {
        for (const walk of walks) {
            const processed = processedOf(walk)
            const groupOf = new Map(
                groupsOf(aggregateHistory(processed, tableOf(walk))).flatMap((group) =>
                    group.actions.map((action) => [action.index, group.id] as const)
                )
            )
            for (const action of processed.filter(isAdvanceTurn)) {
                const index = action.index ?? 0
                if (action.metadata?.outcome === 'next-seat') {
                    expect(groupOf.get(index + 1)).not.toBe(groupOf.get(index - 1))
                }
            }
        }
    })

    it.each(walks.map((walk) => ({ walk, seats: walk.game.players.length })))(
        '$seats seats: a round`s interstitial sits on the StartRound of that number',
        ({ walk }) => {
            const processed = processedOf(walk)
            const started = processed.filter(isStartRound)
            const dividers = aggregateHistory(processed, tableOf(walk)).filter(
                (entry) => entry.kind === 'round'
            )

            expect(dividers.map(({ jumpIndex }) => jumpIndex)).toEqual(
                started.map(({ index }) => index)
            )
            expect(dividers.map(({ round: number }) => number)).toEqual(
                started.map(({ metadata }) => metadata?.round)
            )
        }
    )

    it.each(walks.map((walk) => ({ walk, seats: walk.game.players.length })))(
        '$seats seats: each line comes through describeAction and hides what the seat may not see',
        ({ walk }) => {
            const nameOf = (id: string) =>
                walk.game.players.find((player) => player.id === id)?.name ?? id
            const processed = processedOf(walk)
            for (const { perspective, viewerId } of viewersOf(walk)) {
                const originals = new Map(processed.map((action) => [action.id, action]))
                const received = processed.map((action) => recordFor(action, perspective, walk))
                const entries = aggregateHistory(received, tableOf(walk))
                for (const action of groupsOf(entries).flatMap(({ actions }) => actions)) {
                    const original = originals.get(action.id)
                    assertExists(original, 'Every entry holds an Action that was played')
                    const open = new Set(writsNamedIn(recordFor(original, Spectator, walk)))
                    const known = original.playerId
                        ? recordFor(original, { kind: 'player', playerId: original.playerId }, walk)
                        : original
                    const hidden = writsNamedIn(known).filter((writ) => !open.has(writ))
                    const line = describeAction(action, { viewerId, nameOf })
                    expect(line, action.type).toBeDefined()
                    if (viewerId !== action.playerId) {
                        for (const writId of hidden) {
                            expect(writsNamedIn(action)).not.toContain(writId)
                            expect(line).not.toContain(writWords(writId))
                        }
                    }
                }
            }
        }
    )

    it('The seeded three-seat game reads as stated, by hand from its own record', () => {
        const walk = walks[1]
        expect(walk.game.players).toHaveLength(3)
        const entries = aggregateHistory(processedOf(walk), tableOf(walk))
        const named = spans(entries)

        expect(named.slice(0, 7)).toEqual([
            'single 0-0',
            'single 1-1',
            'single 2-2',
            'single 3-3',
            'single 4-4',
            'single 5-5',
            'hands 7-9'
        ])
        expect(named).toEqual(
            expect.arrayContaining([
                'hands 38-40',
                'nourishing 71-72',
                'progress 73-74',
                'nourishing 109-110',
                'progress 111-111',
                'dawn 112-114',
                'dawn 359-360',
                'single 361-361'
            ])
        )
        expect(entries.find(({ id }) => id === 'round-2')).toMatchObject({ jumpIndex: 37 })
        expect(entries.find(({ id }) => id === 'dawn-112')).toMatchObject({
            jumpIndex: 114,
            replays: true
        })
        // A guild function, its follow-ups and an at-will Action make one seat's turn.
        const guildTurn = groupsOf(entries).find(({ firstIndex }) => firstIndex === 53)
        expect(guildTurn).toMatchObject({
            kind: 'turn',
            lastIndex: 55,
            jumpIndex: 55,
            replays: true
        })
        expect(guildTurn ? typesIn(guildTurn) : []).toEqual([
            ActionType.Conquer,
            ActionType.AnswerAttack,
            ActionType.CommitAttack
        ])
        // The last round's dawn is epoch V's; R-4.11.2 opens on I and runs through each.
        expect(entries.filter(({ kind }) => kind === 'epoch').map(({ id }) => id)).toEqual([
            'epoch-1',
            'epoch-2',
            'epoch-3',
            'epoch-4',
            'epoch-5'
        ])
    })
})
