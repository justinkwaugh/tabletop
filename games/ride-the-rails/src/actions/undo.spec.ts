import {
    assertExists,
    latestPlayerUndoTarget,
    playerUndoReach,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { isFinishBuilding } from './finishBuilding.js'
import { MachineState } from '../definition/states.js'
import type { RideTheRailsGameState } from '../model/gameState.js'
import { engine } from '../testing/fixtures.js'
import { executeInput, walkGame, type Walk, type WalkStep } from '../testing/walk.js'

// A whole-game walk takes about two seconds alone; other suites on the machine slow it.
const WALK_TIMEOUT = 30_000

// Four players: the walk then holds every kind of turn, passes and finished building turns included.
const fourPlayerWalk: Walk = walkGame(4, 11)
// Five players: one placement there ends two building turns.
const fivePlayerWalk: Walk = walkGame(5, 13)

function userAction(step: WalkStep): GameAction {
    const action = step.processed[0]
    assertExists(action, 'A step starts with the user action')
    return action
}

function historyThrough(walk: Walk, stepIndex: number): GameAction[] {
    return walk.steps.slice(0, stepIndex + 1).flatMap((step) => step.processed)
}

function undoStep(step: WalkStep): RideTheRailsGameState {
    return step.processed
        .toReversed()
        .reduce((state, action) => engine.undoProcessedAction({ state, action }), step.after)
}

function cascadeOf(step: WalkStep): string[] {
    return step.processed.map((action) => action.type)
}

function stepIndexWhere(
    walk: Walk,
    matches: (step: WalkStep, index: number) => boolean,
    description: string
): number {
    const index = walk.steps.findIndex(matches)
    expect(index, `The walk has ${description}`).toBeGreaterThanOrEqual(0)
    return index
}

function firstStepOf(walk: Walk, type: ActionType, cascade?: (types: string[]) => boolean): number {
    return stepIndexWhere(
        walk,
        (step) => userAction(step).type === type && (cascade?.(cascadeOf(step)) ?? true),
        `a ${type}`
    )
}

function nextPlayersStepIndex(walk: Walk, stepIndex: number): number | undefined {
    const playerId = userAction(walk.steps[stepIndex]).playerId
    const index = walk.steps.findIndex(
        (step, index) => index > stepIndex && userAction(step).playerId !== playerId
    )
    return index >= 0 ? index : undefined
}

// R-5: the player takes the action back, with its whole cascade, until the next player acts.
function expectUndoableUntilTheNextPlayerActs(walk: Walk, stepIndex: number) {
    const step = walk.steps[stepIndex]
    const action = userAction(step)
    const playerId = action.playerId
    assertExists(playerId, 'A user action has a player')
    assertExists(action.index, 'A processed action has an index')

    expect(latestPlayerUndoTarget(historyThrough(walk, stepIndex), playerId)).toBe(action)
    expect(undoStep(step)).toEqual(step.before)

    const nextIndex = nextPlayersStepIndex(walk, stepIndex) ?? walk.steps.length
    for (let index = stepIndex; index < nextIndex; index++) {
        expect(playerUndoReach(historyThrough(walk, index), playerId)).toBeLessThanOrEqual(
            action.index
        )
    }
    if (nextIndex < walk.steps.length) {
        expect(latestPlayerUndoTarget(historyThrough(walk, nextIndex), playerId)).toBeUndefined()
        expect(playerUndoReach(historyThrough(walk, nextIndex), playerId)).toBeUndefined()
    }
}

describe('undo of each action until the next player acts (R-5)', () => {
    it('takes back a share', () => {
        expectUndoableUntilTheNextPlayerActs(
            fourPlayerWalk,
            firstStepOf(fourPlayerWalk, ActionType.TakeShare)
        )
    })

    it('takes back a placement, with any bonus it paid', () => {
        expectUndoableUntilTheNextPlayerActs(
            fourPlayerWalk,
            firstStepOf(fourPlayerWalk, ActionType.PlaceLocomotive, (types) => types.length === 1)
        )
    })

    it('takes back EndBuilding', () => {
        expectUndoableUntilTheNextPlayerActs(
            fourPlayerWalk,
            firstStepOf(fourPlayerWalk, ActionType.EndBuilding)
        )
    })

    it('takes back a journey', () => {
        expectUndoableUntilTheNextPlayerActs(
            fourPlayerWalk,
            firstStepOf(fourPlayerWalk, ActionType.RideJourney)
        )
    })

    it(
        'takes back every user action of a whole game, and no other player’s',
        () => {
            for (const index of fourPlayerWalk.steps.keys()) {
                expectUndoableUntilTheNextPlayerActs(fourPlayerWalk, index)
            }
        },
        WALK_TIMEOUT
    )

    it('keeps all of a player’s own building turn within reach, back to their share', () => {
        const placementIndex = firstStepOf(fourPlayerWalk, ActionType.PlaceLocomotive)
        const playerId = userAction(fourPlayerWalk.steps[placementIndex]).playerId
        const ownRun = fourPlayerWalk.steps.findLastIndex(
            (step, index) => index < placementIndex && userAction(step).playerId !== playerId
        )
        const firstOwn = userAction(fourPlayerWalk.steps[ownRun + 1])
        const endOfTurn =
            (nextPlayersStepIndex(fourPlayerWalk, placementIndex) ?? fourPlayerWalk.steps.length) -
            1
        assertExists(playerId, 'A placement has a player')
        expect(firstOwn.type).toBe(ActionType.TakeShare)
        expect(playerUndoReach(historyThrough(fourPlayerWalk, endOfTurn), playerId)).toBe(
            firstOwn.index
        )
    })
})

describe('undo of a cascade with its cause (R-5)', () => {
    it('undoes the FinishBuilding a placement at the limit carries, and reopens the building turn', () => {
        const index = firstStepOf(fourPlayerWalk, ActionType.PlaceLocomotive, (types) =>
            types.includes(ActionType.FinishBuilding)
        )
        const step = fourPlayerWalk.steps[index]
        expect(cascadeOf(step)[1]).toBe(ActionType.FinishBuilding)
        expect(step.after.building?.placed ?? 0).toBe(0)
        expect(step.before.building).toBeDefined()
        expectUndoableUntilTheNextPlayerActs(fourPlayerWalk, index)
    })

    it('undoes the EndRound the last journey or pass of a round carries, and reopens the Ride', () => {
        const index = stepIndexWhere(
            fourPlayerWalk,
            (step) => cascadeOf(step).includes(ActionType.EndRound),
            'an end of round'
        )
        const step = fourPlayerWalk.steps[index]
        expect([ActionType.RideJourney, ActionType.PassJourney]).toContain(userAction(step).type)
        expect(step.after.machineState).toBe(MachineState.TakingShares)
        expect(step.before.machineState).toBe(MachineState.Riding)
        expectUndoableUntilTheNextPlayerActs(fourPlayerWalk, index)
    })

    it('undoes the EndGame the last journey or pass of round 6 carries, and reopens the game', () => {
        const index = fourPlayerWalk.steps.length - 1
        const step = fourPlayerWalk.steps[index]
        expect(cascadeOf(step).at(-1)).toBe(ActionType.EndGame)
        expect(step.after.result).toBeDefined()
        expect(step.before.result).toBeUndefined()
        expectUndoableUntilTheNextPlayerActs(fourPlayerWalk, index)

        const replayed = executeInput(fourPlayerWalk.game, undoStep(step), step.input)
        expect(replayed.after.result).toBe(step.after.result)
        expect(replayed.after.winningPlayerIds).toEqual(step.after.winningPlayerIds)
    })

    it('undoes a FinishBuilding for the next builder, whose turn opened with nothing to build, with the placement that caused it', () => {
        const walk = fivePlayerWalk
        const index = firstStepOf(
            walk,
            ActionType.PlaceLocomotive,
            (types) => types.filter((type) => type === ActionType.FinishBuilding).length === 2
        )
        const step = walk.steps[index]
        const [placement, ownFinish, nextFinish] = step.processed
        expect(ownFinish.playerId).toBe(placement.playerId)
        expect(nextFinish.playerId).not.toBe(placement.playerId)
        expect(isFinishBuilding(nextFinish) && nextFinish.metadata).toEqual({
            reason: 'nothing-legal',
            placed: 0
        })
        const nextPlayerId = nextFinish.playerId
        assertExists(nextPlayerId, 'FinishBuilding names its builder')
        expect(latestPlayerUndoTarget(historyThrough(walk, index), nextPlayerId)).not.toBe(
            nextFinish
        )
        expectUndoableUntilTheNextPlayerActs(walk, index)
    })

    it('lets the richest player, who rides last and takes the first share of the next round, take back both', () => {
        const walk = fourPlayerWalk
        const index = stepIndexWhere(
            walk,
            (step, stepIndex) =>
                cascadeOf(step).includes(ActionType.EndRound) &&
                userAction(walk.steps[stepIndex + 1]).playerId === userAction(step).playerId,
            'a rider who takes the next share'
        )
        const [ride, share] = [walk.steps[index], walk.steps[index + 1]]
        const playerId = userAction(ride).playerId
        assertExists(playerId, 'A rider has a player')
        expect(userAction(share).type).toBe(ActionType.TakeShare)
        expect(latestPlayerUndoTarget(historyThrough(walk, index + 1), playerId)).toBe(
            userAction(share)
        )
        expect(playerUndoReach(historyThrough(walk, index + 1), playerId)).toBeLessThanOrEqual(
            userAction(ride).index ?? -1
        )
        expect(undoStep(ride)).toEqual(ride.before)
        expect(undoStep(share)).toEqual(ride.after)
    })

    it('refuses any action once the game has ended', () => {
        const last = fourPlayerWalk.steps.at(-1)
        assertExists(last, 'The fourPlayerWalk took a step')
        expect(() => executeInput(fourPlayerWalk.game, fourPlayerWalk.final, last.input)).toThrow()
    })
})
