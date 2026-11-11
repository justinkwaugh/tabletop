import { describe, expect, it } from 'vitest'
import { Value } from 'typebox/value'
import type { GameAction } from '@tabletop/common'
import { isAdvanceTurn } from '../actions/advanceTurn.js'
import { isAnswerAttack } from '../actions/answerAttack.js'
import { isAnswerStarve } from '../actions/answerStarve.js'
import { isBeginDawn } from '../actions/beginDawn.js'
import { isKeepWrits } from '../actions/keepWrits.js'
import { isPlaceDisc } from '../actions/placeDisc.js'
import { isRollProgressDie } from '../actions/rollProgressDie.js'
import { isScoreGame } from '../actions/scoreGame.js'
import type { FeudumProjectedState } from '../model/gameState.js'
import {
    replayWalk,
    undoAction,
    walkGame,
    withoutClock,
    withoutRowId,
    type GameWalk
} from '../testing/walk.js'
import { ActionType } from './actions.js'
import { FeudumApiActions } from './apiActions.js'
import { FeudumHydrator } from './hydrator.js'
import { FeudumStateHandlers } from './stateHandlers.js'
import { MachineState } from './states.js'

/** A seed whose game goes through every state and ends on a stack emptied mid-round. */
const WalkSeed = '00000000000000000000000000000012'

/** The Actions that play a card from a hand, for the cards still played after R-6.1-H1. */
const CardPlays: readonly string[] = [
    ActionType.Move,
    ActionType.Migrate,
    ActionType.Influence,
    ActionType.Tax,
    ActionType.GuildAction,
    ActionType.Feast,
    ActionType.Explore,
    ActionType.Improve,
    ActionType.TendLandscape,
    ActionType.Harvest,
    ActionType.Conquer,
    ActionType.StarveThePeople,
    ActionType.ForfeitCard,
    ActionType.PlayDefend
]

const walk = walkGame(WalkSeed)

const actions = (played: GameWalk): readonly GameAction[] =>
    played.steps.flatMap(({ processed }) => processed)

const statesAfter = (played: GameWalk): readonly FeudumProjectedState[] =>
    played.steps.flatMap(({ after }) => after)

const hasEmptyStack = ({ regionStacks }: FeudumProjectedState): boolean =>
    Object.values(regionStacks).some((stack) => stack.length === 0)

describe('The machine', () => {
    it('all 18 states map to a handler and no handler lacks a state', () => {
        expect(Object.values(MachineState)).toHaveLength(18)
        expect(Object.keys(FeudumStateHandlers).sort()).toEqual(Object.values(MachineState).sort())
    })

    it('all 39 Action types are registered and hydrate', () => {
        const types = Object.values(ActionType)
        expect(types).toHaveLength(39)
        expect(Object.keys(FeudumApiActions).sort()).toEqual([...types].sort())
        const hydrator = new FeudumHydrator()
        for (const type of types) {
            const action: GameAction = Value.Create(FeudumApiActions[type])
            expect(action.type).toBe(type)
            expect(hydrator.hydrateAction(action).type).toBe(type)
        }
    })
})

describe('A whole game from the seed, user Actions only', () => {
    const played = actions(walk)
    const visited = new Set([
        walk.initial.machineState,
        ...statesAfter(walk).map(({ machineState }) => machineState)
    ])

    it('visits every machine state', () => {
        expect([...visited].sort()).toEqual(Object.values(MachineState).sort())
    })

    it('R-3.14-H1, R-4.8 the attack ask is answered', () => {
        expect(visited).toContain(MachineState.AwaitingDefence)
        expect(visited).toContain(MachineState.CommittingAttack)
        expect(played.some(isAnswerAttack)).toBe(true)
    })

    it('R-3.14-H1, R-3.12.3 the Royal Immunity ask is answered', () => {
        expect(visited).toContain(MachineState.AwaitingImmunity)
        expect(played.some(isAnswerStarve)).toBe(true)
    })

    it('R-3.10.2 takes Shovels & Swords in place of a writ', () => {
        expect(played.filter(isKeepWrits).some((action) => action.shovelsAndSwords)).toBe(true)
    })

    it('R-3.7.5 a voyage draws a writ', () => {
        expect(
            played.filter(isPlaceDisc).some((action) => (action.metadata?.drawnCount ?? 0) > 0)
        ).toBe(true)
    })

    it('R-3.10.3 a seat over the writ limit discards before its turn ends', () => {
        expect(visited).toContain(MachineState.DiscardingWrits)
        expect(
            played.filter(isAdvanceTurn).some((action) => action.metadata?.outcome === 'writ-limit')
        ).toBe(true)
    })

    it('R-4.11.2, R-4.12 dawns II, III and IV, then V, one epoch at a time', () => {
        expect(played.filter(isBeginDawn).map((action) => action.metadata?.epoch)).toEqual([
            2, 3, 4, 5
        ])
    })

    it('R-6.1-H1 a stack emptied mid-round: the cards finish, no die is rolled, the game ends', () => {
        const emptiedAt = statesAfter(walk).findIndex(hasEmptyStack)
        const emptying = statesAfter(walk)[emptiedAt]
        expect(emptying.machineState).toBe(MachineState.PlayingCards)
        expect(emptying.epoch).toBe(4)

        const rest = played.slice(emptiedAt + 1)
        const rollAt = rest.findIndex(isRollProgressDie)
        expect(rest.slice(0, rollAt).some(({ type }) => CardPlays.includes(type))).toBe(true)

        const [roll] = rest.filter(isRollProgressDie)
        expect(roll.metadata?.faces).toEqual([])
        expect(roll.revealsInfo).toBeFalsy()
        expect(rest.slice(rollAt).filter(isBeginDawn)[0].metadata?.epoch).toBe(5)
        expect(rest.some(isScoreGame)).toBe(true)
        expect(walk.final.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('R-X.2 Replay from the seed alone', () => {
    const again = replayWalk(WalkSeed, walk)

    it('gives the same cascade', () => {
        expect(actions(again).map(withoutClock)).toEqual(actions(walk).map(withoutClock))
        expect(statesAfter(again).map(withoutRowId)).toEqual(statesAfter(walk).map(withoutRowId))
    })

    it('gives the same final state', () => {
        expect(withoutRowId(again.final)).toEqual(withoutRowId(walk.final))
    })

    it('another seed deals another game', () => {
        const other = walkGame('0123456789abcdef0123456789abcdef').initial
        expect(withoutRowId(other)).not.toEqual(withoutRowId(walk.initial))
    })
})

describe('R-X.2 Undo', () => {
    /** Every Action newest first, each with the state it was processed on. */
    const backwards = walk.steps
        .flatMap(({ before, processed, after }) =>
            processed.map((action, index) => ({
                action,
                before: index === 0 ? before : after[index - 1]
            }))
        )
        .reverse()

    it('undoing to each barrier gives the state before it, and the first Action the start', () => {
        let state = walk.final
        let barriers = 0
        for (const { action, before } of backwards) {
            state = undoAction(action, state)
            if (action.revealsInfo) {
                barriers += 1
                expect(state).toEqual(before)
            }
        }
        expect(barriers).toBeGreaterThan(0)
        expect(state).toEqual(walk.initial)
    })
})
