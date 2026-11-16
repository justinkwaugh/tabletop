import { assertExists, GameResult, validateGameResult, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isEndGame } from '../actions/endGame.js'
import { isEndRound } from '../actions/endRound.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { RideTheRailsGameState } from '../model/gameState.js'
import { ROUND_COUNT } from '../rules/endOfRound.js'
import { engine } from '../testing/fixtures.js'
import { offersByPlayer } from '../testing/offers.js'
import { walkGame, type Walk } from '../testing/walk.js'

// A whole-game walk takes about two seconds alone; other suites on the machine slow it.
const WALK_TIMEOUT = 30_000

type SchedulePhase = PhaseName | 'ending' | 'ended'

const NEXT_PHASE: Record<PhaseName, SchedulePhase> = {
    [PhaseName.TakeShare]: PhaseName.Build,
    [PhaseName.Build]: PhaseName.Ride,
    [PhaseName.Ride]: 'ending'
}

const PHASE_STATE: Record<PhaseName, MachineState> = {
    [PhaseName.TakeShare]: MachineState.TakingShares,
    [PhaseName.Build]: MachineState.Building,
    [PhaseName.Ride]: MachineState.Riding
}

// An independent model of R-2: six rounds of three phases, Take a Share in reverse turn order,
// Build and Ride in turn order, each player's whole phase action before the next player's,
// then the end of round (R-2.5) or, after round 6, the end of the game (R-6.1).
class TurnSchedule {
    round = 1
    phase: SchedulePhase = PhaseName.TakeShare
    turnsTaken = 0

    constructor(public turnOrder: string[]) {}

    decidingSeat(): string {
        const phase = this.openPhase()
        const order = phase === PhaseName.TakeShare ? this.turnOrder.toReversed() : this.turnOrder
        const playerId = order[this.turnsTaken]
        assertExists(playerId, `Every turn of ${phase} is taken`)
        return playerId
    }

    follow(action: GameAction) {
        switch (action.type) {
            case ActionType.TakeShare:
            case ActionType.SkipShare:
                return this.endTurn(PhaseName.TakeShare, action)
            case ActionType.PlaceLocomotive:
                return this.expectTurn(PhaseName.Build, action)
            case ActionType.EndBuilding:
            case ActionType.FinishBuilding:
                return this.endTurn(PhaseName.Build, action)
            case ActionType.RideJourney:
            case ActionType.PassJourney:
                return this.endTurn(PhaseName.Ride, action)
            case ActionType.EndRound:
                return this.endRound(action)
            case ActionType.EndGame:
                return this.endGame()
            default:
                throw Error(`The schedule has no place for ${action.type}`)
        }
    }

    expectState(state: RideTheRailsGameState) {
        if (this.phase === 'ended') {
            expect(state.machineState).toBe(MachineState.Ended)
            expect(state.result).toBeDefined()
            expect(state.activePlayerIds).toEqual([])
            expect(Object.values(offersByPlayer(state)).flat()).toEqual([])
            return
        }
        const phase = this.openPhase()
        const seat = this.decidingSeat()
        expect(state.machineState).toBe(PHASE_STATE[phase])
        expect(state.result).toBeUndefined()
        expect(state.roundManager.series.at(-1)).toMatchObject({ number: this.round })
        expect(state.phaseManager.series.at(-1)).toMatchObject({ name: phase })
        expect(state.phaseManager.series.at(-1)?.end).toBeUndefined()
        expect(state.turnManager.turnOrder).toEqual(this.turnOrder)
        expect(state.activePlayerIds).toEqual([seat])
        const turn = state.turnManager.series.at(-1)
        expect(turn?.playerId).toBe(seat)
        expect(turn?.end).toBeUndefined()
        expect(state.building !== undefined).toBe(phase === PhaseName.Build)

        const offers = offersByPlayer(state)
        for (const [playerId, types] of Object.entries(offers)) {
            expect(types.length > 0, `${playerId} is offered ${types.join(', ')}`).toBe(
                playerId === seat
            )
        }
    }

    private openPhase(): PhaseName {
        const phase = this.phase
        if (phase === 'ending' || phase === 'ended') {
            throw Error(`No phase is open while ${phase}`)
        }
        return phase
    }

    private expectTurn(phase: PhaseName, action: GameAction) {
        expect(this.phase).toBe(phase)
        expect(action.playerId).toBe(this.decidingSeat())
    }

    private endTurn(phase: PhaseName, action: GameAction) {
        this.expectTurn(phase, action)
        this.turnsTaken += 1
        if (this.turnsTaken === this.turnOrder.length) {
            this.phase = NEXT_PHASE[phase]
            this.turnsTaken = 0
        }
    }

    // R-2.5.1: lowest money first; the tie order is endOfRound.spec.ts's.
    private endRound(action: GameAction) {
        expect(this.phase).toBe('ending')
        expect(this.round).toBeLessThan(ROUND_COUNT)
        const metadata = isEndRound(action) ? action.metadata : undefined
        assertExists(metadata, 'EndRound records the round')
        expect(metadata.round).toBe(this.round)
        expect(metadata.turnOrder.toSorted()).toEqual(this.turnOrder.toSorted())
        const money = metadata.money.map((entry) => entry.money)
        expect(money).toEqual(money.toSorted((a, b) => a - b))

        this.turnOrder = metadata.turnOrder
        this.round += 1
        this.phase = PhaseName.TakeShare
    }

    private endGame() {
        expect(this.phase).toBe('ending')
        expect(this.round).toBe(ROUND_COUNT)
        this.phase = 'ended'
    }
}

const walks = new Map<string, Walk>()

function walked(playerCount: number, seed: number): Walk {
    const key = `${playerCount}:${seed}`
    const walk = walks.get(key) ?? walkGame(playerCount, seed)
    walks.set(key, walk)
    return walk
}

function scheduledWalk(playerCount: number, seed: number): { walk: Walk; schedule: TurnSchedule } {
    let schedule: TurnSchedule | undefined
    const walk = walkGame(playerCount, seed, ({ before, after, processed }) => {
        schedule ??= openingSchedule(before)
        for (const action of processed) {
            schedule.follow(action)
        }
        schedule.expectState(after)
    })
    assertExists(schedule, 'The walk took a step')
    walks.set(`${playerCount}:${seed}`, walk)
    return { walk, schedule }
}

function openingSchedule(initial: RideTheRailsGameState): TurnSchedule {
    const schedule = new TurnSchedule([...initial.turnManager.turnOrder])
    schedule.expectState(initial)
    return schedule
}

// The engine stamps each action with the wall clock as it processes it; no rule reads it.
function withoutClock({
    createdAt: _createdAt,
    ...action
}: GameAction): Omit<GameAction, 'createdAt'> {
    return action
}

function countOf(history: GameAction[], type: ActionType): number {
    return history.filter((action) => action.type === type).length
}

describe.each([3, 4, 5])(
    'the turn engine with %i players (R-2.1, R-2.2, R-2.5, R-6.1)',
    (playerCount) => {
        it(
            'walks all six rounds and every phase, checking the state and deciding seat after each action',
            () => {
                const { walk, schedule } = scheduledWalk(playerCount, 11)
                expect(schedule.phase).toBe('ended')
                expect(schedule.round).toBe(ROUND_COUNT)

                const { history, final } = walk
                expect(countOf(history, ActionType.EndRound)).toBe(ROUND_COUNT - 1)
                expect(countOf(history, ActionType.EndGame)).toBe(1)
                expect(
                    countOf(history, ActionType.TakeShare) + countOf(history, ActionType.SkipShare)
                ).toBe(ROUND_COUNT * playerCount)
                expect(
                    countOf(history, ActionType.EndBuilding) +
                        countOf(history, ActionType.FinishBuilding)
                ).toBe(ROUND_COUNT * playerCount)
                expect(
                    countOf(history, ActionType.RideJourney) +
                        countOf(history, ActionType.PassJourney)
                ).toBe(ROUND_COUNT * playerCount)
                expect(countOf(history, ActionType.PlaceLocomotive)).toBeGreaterThan(0)
                expect(countOf(history, ActionType.RideJourney)).toBeGreaterThan(0)

                expect(final.roundManager.series.map((round) => round.number)).toEqual([
                    1, 2, 3, 4, 5, 6
                ])
                expect(final.roundManager.series.every((round) => round.end !== undefined)).toBe(
                    true
                )
                expect(final.phaseManager.series.map((phase) => phase.name)).toEqual(
                    Array.from({ length: ROUND_COUNT }, () => [
                        PhaseName.TakeShare,
                        PhaseName.Build,
                        PhaseName.Ride
                    ]).flat()
                )
                expect(final.turnManager.series).toHaveLength(3 * ROUND_COUNT * playerCount)
                expect([GameResult.Win, GameResult.Draw]).toContain(final.result)
                expect(() => validateGameResult(final)).not.toThrow()
            },
            WALK_TIMEOUT
        )

        it(
            'records each round, phase and turn as a span of action indexes, each after the last',
            () => {
                const { final, history } = walked(playerCount, 11)
                expect(history.map((action) => action.index)).toEqual(
                    history.map((_, index) => index)
                )
                for (const series of [
                    final.roundManager.series,
                    final.phaseManager.series,
                    final.turnManager.series
                ]) {
                    for (const [index, span] of series.entries()) {
                        expect(span.end).toBeDefined()
                        expect(span.start).toBeLessThanOrEqual(span.end ?? -1)
                        expect(span.start).toBeGreaterThanOrEqual(series[index - 1]?.end ?? 0)
                    }
                }
                const lastAction = history.at(-1)
                expect(isEndGame(lastAction)).toBe(true)
                expect(final.roundManager.series.at(-1)?.end).toBe((lastAction?.index ?? 0) + 1)
            },
            WALK_TIMEOUT
        )
    }
)

describe.each([3, 4, 5])('a seeded walk with %i players (R-5, R-X.2)', (playerCount) => {
    it(
        'is the same game each time it is played from the same seed',
        () => {
            const first = walked(playerCount, 12)
            const again = walkGame(playerCount, 12)
            expect(again.history.map(withoutClock)).toEqual(first.history.map(withoutClock))
            expect({ ...again.final, id: first.final.id }).toEqual(first.final)
        },
        WALK_TIMEOUT
    )

    it(
        'replays to the same final state, and undoing every action in reverse gives back each prior state',
        () => {
            const { game, initial, history, final } = walked(playerCount, 12)
            const befores: RideTheRailsGameState[] = []
            let replayed = initial
            for (const action of history) {
                befores.push(replayed)
                replayed = engine.applyProcessedAction({ game, state: replayed, action })
            }
            expect(replayed).toEqual(final)

            let undone = final
            for (let index = history.length - 1; index >= 0; index--) {
                undone = engine.undoProcessedAction({ state: undone, action: history[index] })
                expect(undone).toEqual(befores[index])
            }
            expect(undone).toEqual(initial)
        },
        WALK_TIMEOUT
    )

    it(
        'never reveals information, so undo is never stopped by a reveal (R-X.2)',
        () => {
            const { history } = walked(playerCount, 12)
            expect(history.filter((action) => action.revealsInfo)).toEqual([])
        },
        WALK_TIMEOUT
    )
})
