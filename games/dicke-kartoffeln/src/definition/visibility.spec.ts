import { describe, expect, it } from 'vitest'
import { assert, assertExists, getPrng, Visibility } from '@tabletop/common'
import { MESSAGE_IDS } from '../components/messages.js'
import { Variety } from '../components/potatoes.js'
import { isRevealPlans } from '../actions/revealPlans.js'
import { isSubmitPlan } from '../actions/submitPlan.js'
import {
    DickeKartoffelnGameStateValidator,
    type DickeKartoffelnProjectedState
} from '../model/gameState.js'
import { PlanKind, type Plan } from '../model/plans.js'
import { Table, engine } from '../testing/table.js'
import { DickeKartoffelnActionSchemas } from './actionSchemas.js'
import { ActionType } from './actions.js'
import { DickeKartoffelnRuntime } from './runtime.js'
import { MachineState } from './states.js'

type Perspective = Visibility.Perspective

const farmer = { kind: 'player', playerId: 'p1' } as const
const rival = { kind: 'player', playerId: 'p2' } as const
const spectator = { kind: 'spectator' } as const
const perspectives: Perspective[] = [farmer, rival, spectator]

const sowing: Plan = {
    kind: PlanKind.Sow,
    seeds: [
        { fieldId: 1, variety: Variety.Amalie },
        { fieldId: 2, variety: Variety.Chris }
    ]
}

function projectState(state: DickeKartoffelnProjectedState, perspective: Perspective) {
    assert(DickeKartoffelnGameStateValidator.Check(state), 'Expected complete canonical state')
    return DickeKartoffelnRuntime.visibility.state.project(state, perspective)
}

// Every farmer has ploughed fields 1 and 2 and is choosing what to sow.
function atSowing(): Table {
    const table = new Table(3)
    table.playRound({
        p0: { kind: PlanKind.TakeCompost, takes: [] },
        p1: { kind: PlanKind.TakeCompost, takes: [] },
        p2: { kind: PlanKind.TakeCompost, takes: [] }
    })
    const ploughing: Plan = { kind: PlanKind.Cultivate, fieldIds: [1, 2] }
    table.playRound({ p0: ploughing, p1: ploughing, p2: ploughing })
    expect(table.state.machineState).toBe(MachineState.Sowing)
    return table
}

describe('Dicke Kartoffeln protected visibility', () => {
    it('registers every action type for projection', () => {
        expect(Object.keys(DickeKartoffelnActionSchemas).sort()).toEqual(
            Object.values(ActionType).sort()
        )
    })

    it('hides the message deck order and the protected randomness', () => {
        const table = new Table(4)
        expect(table.state.messages?.deck.remaining).toBe(MESSAGE_IDS.length - 3)
        for (const perspective of perspectives) {
            const projected = projectState(table.state, perspective)
            expect(projected).not.toHaveProperty('masterSeed')
            expect(projected.messages?.deck).toEqual({ items: [], remaining: 17 })
            expect(projected.messages?.spaces).toEqual(table.state.messages?.spaces)
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(DickeKartoffelnRuntime.hydrator.hydrateState(projected).dehydrate()).toEqual(
                projected
            )
        }
    })

    it('shows a sealed plan only to the farmer who made it', () => {
        const table = atSowing()
        const before = table.state
        table.submit('p1', sowing)
        for (const perspective of perspectives) {
            const projected = projectState(table.state, perspective)
            const owns = perspective.kind === 'player' && perspective.playerId === 'p1'
            const planner = projected.players.find((player) => player.playerId === 'p1')
            if (owns) expect(planner?.plan).toEqual(sowing)
            else expect(planner).not.toHaveProperty('plan')
            expect(projected.activePlayerIds).toEqual(['p0', 'p2'])
            expect(DickeKartoffelnRuntime.hydrator.hydrateState(projected).dehydrate()).toEqual(
                projected
            )
            const history = Visibility.projectActionHistory({
                currentState: table.state,
                actions: table.processed,
                visibility: DickeKartoffelnRuntime.visibility,
                perspective,
                replay: { game: table.game, runtime: DickeKartoffelnRuntime }
            })
            const submission = history.actions.at(-1)
            assertExists(submission, 'The plan is in the history')
            expect(submission.type).toBe(ActionType.SubmitPlan)
            if (owns) expect(submission).toHaveProperty('plan', sowing)
            else expect(submission).not.toHaveProperty('plan')
            const replayed = engine.applyProcessedAction({
                game: table.game,
                state: projectState(before, perspective),
                action: submission
            })
            expect(replayed).toEqual(history.currentState)
        }
    })

    it('lets each farmer find their decision and seal it from their own projection', () => {
        const table = atSowing()
        table.submit('p0', { kind: PlanKind.Sow, seeds: [] })
        expect(
            engine.getValidActionTypesForPlayer(
                table.game,
                projectState(table.state, farmer),
                'p1',
                {
                    perspective: farmer
                }
            )
        ).toEqual([ActionType.SubmitPlan])
        expect(
            engine.getValidActionTypesForPlayer(
                table.game,
                projectState(table.state, rival),
                'p0',
                {
                    perspective: rival
                }
            )
        ).toEqual([])
        const action = {
            id: 'sow-p1',
            gameId: table.game.id,
            source: table.processed[0].source,
            type: ActionType.SubmitPlan,
            playerId: 'p1',
            plan: sowing,
            simultaneousGroupId: '1-Sowing'
        }
        const canonical = engine.executeCanonicalAction({
            game: table.game,
            state: table.state,
            action
        })
        const optimistic = engine.executeAction({
            game: table.game,
            state: projectState(table.state, farmer),
            action,
            perspective: farmer
        })
        expect(optimistic.updatedState).toEqual(projectState(canonical.updatedState, farmer))
    })

    it('reveals every plan together once the last farmer commits', () => {
        const table = atSowing()
        table.submit('p0', { kind: PlanKind.Sow, seeds: [] })
        table.submit('p1', sowing)
        const processed = table.submit('p2', {
            kind: PlanKind.Sow,
            seeds: [{ fieldId: 1, variety: Variety.Biola }]
        })
        const reveal = processed.find(isRevealPlans)
        assertExists(reveal, 'The last plan opens them all')
        expect(reveal.revealsInfo).toBe(true)
        for (const perspective of perspectives) {
            const projected = DickeKartoffelnRuntime.visibility.actions.project(reveal, perspective)
            expect(projected).toMatchObject({
                metadata: {
                    outcomes: [
                        { playerId: 'p0', plan: { kind: PlanKind.Sow, seeds: [] } },
                        { playerId: 'p1', plan: sowing },
                        {
                            playerId: 'p2',
                            plan: { seeds: [{ fieldId: 1, variety: Variety.Biola }] }
                        }
                    ]
                }
            })
            const state = projectState(table.state, perspective)
            expect(state.players.every((player) => player.plan === undefined)).toBe(true)
            expect(state.players[1].fields[0].seed).toBe(Variety.Amalie)
        }
        expect(processed.filter(isSubmitPlan)).toHaveLength(1)
    })

    it('imagines the unseen deck and rivals’ sealed plans for exploration', () => {
        const table = atSowing()
        table.submit('p2', sowing)
        const otherWorld = structuredClone(table.state)
        const rivalPlanner = otherWorld.players.find((player) => player.playerId === 'p2')
        assertExists(rivalPlanner, 'p2 is farming')
        rivalPlanner.plan = { kind: PlanKind.Sow, seeds: [{ fieldId: 2, variety: Variety.Biola }] }
        const populate = (source: DickeKartoffelnProjectedState, perspective: Perspective) =>
            DickeKartoffelnRuntime.exploration.createFromProjectedState({
                game: table.game,
                state: projectState(source, perspective),
                actions: [],
                perspective,
                random: getPrng(1234)
            })
        const sample = populate(table.state, farmer)
        expect(sample).toEqual(populate(otherWorld, farmer))
        expect(DickeKartoffelnGameStateValidator.Check(sample)).toBe(true)
        expect(sample.players[2].plan).toEqual({ kind: PlanKind.Sow, seeds: [] })
        expect(sample.players[1].plan).toBeUndefined()
        const known = new Set([
            ...(sample.messages?.spaces.map((card) => card.messageId) ?? []),
            ...(sample.messages?.read ?? [])
        ])
        expect(sample.messages?.deck.items).toHaveLength(17)
        expect(sample.messages?.deck.items.some((messageId) => known.has(messageId))).toBe(false)
        const own = populate(table.state, { kind: 'player', playerId: 'p2' })
        expect(own.players[2].plan).toEqual(sowing)
    })
})
