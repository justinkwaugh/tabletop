import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    createCallGameAction,
    type GameAction,
    type Phase,
    type Round
} from '@tabletop/common'
import {
    ActionType,
    PhaseName,
    isEndGame,
    isEndRound,
    isFinishBuilding,
    isSkipShare,
    cityById,
    type EndBuilding,
    type EndGame,
    type EndRound,
    type FinishBuilding,
    type PassJourney,
    type PlaceLocomotive,
    type RailroadId,
    type RideJourney,
    type TakeShare
} from '@tabletop/ride-the-rails'
import { playCompleteGame } from '@tabletop/ride-the-rails/testing'
import { readDescription } from '$lib/testing/readDescription.js'
import { describeAction, type Description } from './describeAction.js'
import {
    buildingTurnDescription,
    historyEntries,
    historyStep,
    historyStepLine,
    jumpTarget,
    openEntryKey,
    phaseHeading,
    replayRange,
    turnDescription,
    type HistoryEntry,
    type HistoryTurn
} from './history.js'

const NAMES: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Ben', p3: 'Cy' }

const CHICAGO_HEX = cityById('city.usa.chicago').hexId
const DENVER_HEX = cityById('city.usa.denver').hexId
const OMAHA_HEX = cityById('city.usa.omaha').hexId

function base(index: number, source = ActionSource.User) {
    return { id: `a${index}`, gameId: 'g1', index, source }
}

function share(index: number, playerId: string, railroadId: RailroadId): TakeShare {
    return {
        ...base(index),
        type: ActionType.TakeShare,
        playerId,
        railroadId,
        metadata: { shares: 1, supplyLeft: 20 }
    }
}

function place(
    index: number,
    playerId: string,
    railroadId: RailroadId,
    hexId = OMAHA_HEX,
    bonuses: NonNullable<PlaceLocomotive['metadata']>['bonuses'] = []
): PlaceLocomotive {
    return {
        ...base(index),
        type: ActionType.PlaceLocomotive,
        playerId,
        railroadId,
        hexId,
        metadata: { isStart: false, bonuses }
    }
}

function endBuilding(index: number, playerId: string, placed: number): EndBuilding {
    return { ...base(index), type: ActionType.EndBuilding, playerId, metadata: { placed } }
}

function finishBuilding(
    index: number,
    playerId: string,
    reason: 'limit' | 'nothing-legal',
    placed: number
): FinishBuilding {
    return {
        ...base(index, ActionSource.System),
        type: ActionType.FinishBuilding,
        playerId,
        metadata: { reason, placed }
    }
}

function journey(index: number, playerId: string): RideJourney {
    return {
        ...base(index),
        type: ActionType.RideJourney,
        playerId,
        links: [],
        metadata: {
            startCityId: 'city.usa.chicago',
            endCityId: 'city.usa.omaha',
            cityIds: ['city.usa.chicago', 'city.usa.omaha'],
            linksPerRailroad: { 'railroad.red': 1 },
            payments: [
                { playerId: 'p1', dividends: 1, fare: 0 },
                { playerId: 'p2', dividends: 0, fare: 2 }
            ]
        }
    }
}

function pass(index: number, playerId: string): PassJourney {
    return { ...base(index), type: ActionType.PassJourney, playerId }
}

function endRound(index: number): EndRound {
    return {
        ...base(index, ActionSource.System),
        type: ActionType.EndRound,
        metadata: {
            round: 1,
            turnOrder: ['p2', 'p1'],
            money: [
                { playerId: 'p2', money: 5 },
                { playerId: 'p1', money: 7 }
            ]
        }
    }
}

function endGame(index: number): EndGame {
    return {
        ...base(index, ActionSource.System),
        type: ActionType.EndGame,
        metadata: {
            money: [
                { playerId: 'p1', money: 30 },
                { playerId: 'p2', money: 25 }
            ],
            winningPlayerIds: ['p1']
        }
    }
}

const ROUND_1: Round[] = [{ type: 'round', number: 1, start: 0 }]

function phases(...starts: [PhaseName, number][]): Phase[] {
    return starts.map(([name, start]) => ({ type: 'phase', name, start }))
}

function reading(description: Description, readerId: string | undefined): string {
    return readDescription(description, readerId, NAMES)
}

function turns(entries: readonly HistoryEntry[]): HistoryTurn[] {
    return entries.filter((entry): entry is HistoryTurn => entry.kind === 'turn')
}

function onlyTurn(entries: readonly HistoryEntry[]): HistoryTurn {
    const [turn, ...rest] = turns(entries)
    expect(rest).toEqual([])
    return turn
}

describe('a building turn is one entry (R-3.2, R-4.3)', () => {
    const fivePlacements = [
        place(0, 'p1', 'railroad.red', CHICAGO_HEX, [
            { bonusId: 'bonus.usa.chicago', amount: 2, cityId: 'city.usa.chicago' }
        ]),
        place(1, 'p1', 'railroad.blue'),
        place(2, 'p1', 'railroad.red'),
        place(3, 'p1', 'railroad.blue', DENVER_HEX, [
            { bonusId: 'bonus.usa.five-dollar', amount: 5, cityId: 'city.usa.denver' }
        ]),
        place(4, 'p1', 'railroad.red')
    ]

    it('reads its placements by railroad and its bonuses, as the actor, another seat and a spectator', () => {
        const entries = historyEntries(
            [...fivePlacements, endBuilding(5, 'p1', 5)],
            ROUND_1,
            phases([PhaseName.Build, 0])
        )
        const turn = onlyTurn(entries)
        expect(turn.closed).toBe(true)
        expect(turn.actions).toHaveLength(6)
        const description = turnDescription(turn)
        expect(reading(description, 'p1')).toBe('You built 3 Red 2 Blue · Chicago $2 · Denver $5')
        expect(reading(description, 'p2')).toBe('Ana built 3 Red 2 Blue · Chicago $2 · Denver $5')
        expect(reading(description, undefined)).toBe(
            'Ana built 3 Red 2 Blue · Chicago $2 · Denver $5'
        )
    })

    it('grows as placements arrive and stays open until the turn ends', () => {
        const entries = historyEntries(
            fivePlacements.slice(0, 2),
            ROUND_1,
            phases([PhaseName.Build, 0])
        )
        const turn = onlyTurn(entries)
        expect(turn.closed).toBe(false)
        expect(reading(buildingTurnDescription(turn), 'p2')).toBe(
            'Ana built 1 Red 1 Blue · Chicago $2'
        )
    })

    it('closes with its reason when it ended by itself (R-3.2.3, R-3.2.4)', () => {
        const limit = onlyTurn(
            historyEntries(
                [...fivePlacements, finishBuilding(5, 'p1', 'limit', 5)],
                ROUND_1,
                phases([PhaseName.Build, 0])
            )
        )
        expect(limit.closed).toBe(true)
        expect(reading(turnDescription(limit), 'p2')).toBe(
            'Ana built 3 Red 2 Blue · Chicago $2 · Denver $5'
        )

        const stuck = onlyTurn(
            historyEntries(
                [finishBuilding(0, 'p1', 'nothing-legal', 0)],
                ROUND_1,
                phases([PhaseName.Build, 0])
            )
        )
        expect(reading(turnDescription(stuck), 'p2')).toBe(
            'Ana built nothing · no legal placement left'
        )
    })

    it('reads an ended turn with nothing placed', () => {
        const turn = onlyTurn(
            historyEntries([endBuilding(0, 'p1', 0)], ROUND_1, phases([PhaseName.Build, 0]))
        )
        expect(reading(turnDescription(turn), 'p1')).toBe('You built nothing')
    })

    it('starts a new entry for the next seat, even one cascaded from the last', () => {
        const entries = historyEntries(
            [
                place(0, 'p1', 'railroad.red'),
                endBuilding(1, 'p1', 1),
                finishBuilding(2, 'p2', 'nothing-legal', 0),
                place(3, 'p1', 'railroad.red')
            ],
            ROUND_1,
            phases([PhaseName.Build, 0])
        )
        expect(
            turns(entries).map(({ playerId, firstIndex, lastIndex, settledIndex, closed }) => ({
                playerId,
                firstIndex,
                lastIndex,
                settledIndex,
                closed
            }))
        ).toEqual([
            // Jumping to the first turn shows the table before the next seat's turn closed.
            { playerId: 'p1', firstIndex: 0, lastIndex: 1, settledIndex: 1, closed: true },
            { playerId: 'p2', firstIndex: 2, lastIndex: 2, settledIndex: 2, closed: true },
            { playerId: 'p1', firstIndex: 3, lastIndex: 3, settledIndex: 3, closed: false }
        ])
    })
})

describe('interstitials and milestones (R-2.1, R-2.5)', () => {
    const actions: GameAction[] = [
        share(0, 'p2', 'railroad.red'),
        share(1, 'p1', 'railroad.blue'),
        place(2, 'p1', 'railroad.blue'),
        endBuilding(3, 'p1', 1),
        endBuilding(4, 'p2', 0),
        journey(5, 'p1'),
        pass(6, 'p2'),
        endRound(7)
    ]
    const series = phases(
        [PhaseName.TakeShare, 0],
        [PhaseName.Build, 2],
        [PhaseName.Ride, 5],
        [PhaseName.TakeShare, 8]
    )
    const rounds: Round[] = [
        { type: 'round', number: 1, start: 0, end: 7 },
        { type: 'round', number: 2, start: 8 }
    ]

    it('heads each phase with its round, puts the end of round between, and opens the next phase before its first action', () => {
        const entries = historyEntries(actions, rounds, series)
        const outline = entries.map((entry) =>
            entry.kind === 'phase'
                ? phaseHeading(entry)
                : entry.kind === 'turn'
                  ? `${entry.turn} ${entry.playerId}`
                  : entry.action.type
        )
        expect(outline).toEqual([
            'Round I · Shares',
            'share p2',
            'share p1',
            'Round I · Build',
            'building p1',
            'building p2',
            'Round I · Ride',
            'journey p1',
            'pass p2',
            ActionType.EndRound,
            'Round II · Shares'
        ])
    })

    it('marks the last turn as the open entry', () => {
        const entries = historyEntries(actions, rounds, series)
        const last = turns(entries).at(-1)
        expect(openEntryKey(entries)).toBe(last?.key)
        expect(last?.turn).toBe('pass')
    })

    it('jumps on turns and on round and phase lines; replays only building turns and journeys', () => {
        const entries = historyEntries([...actions, endGame(8)], rounds, series.slice(0, 3))
        const offers = entries.map((entry) => ({
            entry:
                entry.kind === 'phase'
                    ? phaseHeading(entry)
                    : entry.kind === 'turn'
                      ? `${entry.turn} ${entry.playerId}`
                      : entry.action.type,
            jump: jumpTarget(entry),
            replay: replayRange(entry)
        }))
        expect(offers).toEqual([
            {
                entry: 'Round I · Shares',
                jump: { actionIndex: -1, exact: true },
                replay: undefined
            },
            { entry: 'share p2', jump: { actionIndex: 0, exact: true }, replay: undefined },
            { entry: 'share p1', jump: { actionIndex: 1, exact: true }, replay: undefined },
            {
                entry: 'Round I · Build',
                jump: { actionIndex: 1, exact: true },
                replay: undefined
            },
            {
                entry: 'building p1',
                jump: { actionIndex: 3, exact: true },
                replay: { startIndex: 2, endIndex: 3 }
            },
            // Nothing placed, so nothing moves on the map.
            { entry: 'building p2', jump: { actionIndex: 4, exact: true }, replay: undefined },
            {
                entry: 'Round I · Ride',
                jump: { actionIndex: 4, exact: true },
                replay: undefined
            },
            {
                entry: 'journey p1',
                jump: { actionIndex: 5, exact: true },
                replay: { startIndex: 5, endIndex: 5 }
            },
            // The round's last pass carries the end of the round, so its table is the new order.
            { entry: 'pass p2', jump: { actionIndex: 7, exact: true }, replay: undefined },
            {
                entry: ActionType.EndRound,
                jump: { actionIndex: 7, exact: true },
                replay: undefined
            },
            { entry: ActionType.EndGame, jump: undefined, replay: undefined }
        ])
    })
})

describe('the history description (docs/game-ui-layout.md, History description)', () => {
    it('is the last User Action and the System Actions it set off', () => {
        const actions = [journey(5, 'p1'), pass(6, 'p2'), endRound(7)]
        const step = historyStep(actions.toReversed())
        expect(step.action?.id).toBe('a6')
        expect(step.consequences.map(({ id }) => id)).toEqual(['a7'])
    })

    it('is empty before the first action', () => {
        expect(historyStep([])).toEqual({ action: undefined, consequences: [] })
    })

    it('draws a called game with the platform description, not its action type', () => {
        const called = createCallGameAction({
            gameId: 'game',
            index: 7,
            ballot: {
                initiatorPlayerId: 'p1',
                approvingPlayerIds: ['p1', 'p2', 'p3'],
                decliningPlayerIds: []
            },
            players: ['p1', 'p2', 'p3']
        })
        const step = historyStep([journey(5, 'p1'), pass(6, 'p2'), called])
        expect(step.consequences).toEqual([called])
        expect(historyStepLine(called)).toEqual({ kind: 'called', action: called })
        const pass6 = pass(6, 'p2')
        expect(historyStepLine(pass6)).toEqual({
            kind: 'sentence',
            description: describeAction(pass6)
        })
    })
})

describe('a whole game (R-2.1, R-3.1–R-3.3, R-2.5)', () => {
    for (const railroads of ['least-taken', 'scarcest'] as const) {
        it(`folds every action into one entry, with one interstitial per phase (${railroads})`, () => {
            const { history, final } = playCompleteGame(4, 7, { railroads })
            const entries = historyEntries(
                history,
                final.roundManager.series,
                final.phaseManager.series
            )

            const covered = entries.flatMap((entry) =>
                entry.kind === 'turn'
                    ? entry.actions
                    : entry.kind === 'milestone'
                      ? [entry.action]
                      : []
            )
            expect(covered.map(({ id }) => id)).toEqual(history.map(({ id }) => id))

            const headings = entries.filter((entry) => entry.kind === 'phase')
            expect(headings).toHaveLength(final.phaseManager.series.length)
            expect(headings.map(phaseHeading).slice(0, 3)).toEqual([
                'Round I · Shares',
                'Round I · Build',
                'Round I · Ride'
            ])
            expect(phaseHeading(headings[headings.length - 1])).toBe('Round VI · Ride')

            const milestones = entries.filter((entry) => entry.kind === 'milestone')
            expect(milestones.filter(({ action }) => isEndRound(action))).toHaveLength(5)
            expect(milestones.filter(({ action }) => isEndGame(action))).toHaveLength(1)

            for (const turn of turns(entries)) {
                expect(turn.closed).toBe(true)
                expect(turn.actions.every(({ playerId }) => playerId === turn.playerId)).toBe(true)
                if (turn.turn !== 'building') {
                    expect(turn.actions).toHaveLength(1)
                }
                expect(reading(turnDescription(turn), undefined)).not.toMatch(/undefined/)
            }

            // R-3.1, R-3.2.4: SkipShare and FinishBuilding fold into their seat's entry.
            const folded = history.filter(
                (action) => isSkipShare(action) || isFinishBuilding(action)
            )
            expect(
                folded.every((action) =>
                    turns(entries).some((turn) => turn.actions.includes(action))
                )
            ).toBe(true)
        })
    }

    it('describes every History Step as its User Action and consequences', () => {
        const { steps } = playCompleteGame(3, 11)
        let shown: GameAction[] = []
        for (const step of steps) {
            shown = [...shown, ...step.processed]
            const { action, consequences } = historyStep(shown)
            expect(action?.id).toBe(step.submitted.id)
            expect(consequences.map(({ id }) => id)).toEqual(
                step.processed.slice(1).map(({ id }) => id)
            )
            expect(reading(describeAction(step.processed[0]), undefined)).not.toBe(
                step.processed[0].type
            )
        }
    })
})
