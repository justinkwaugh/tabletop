import { describe, expect, it } from 'vitest'
import {
    ExplorationHistory,
    Visibility,
    assert,
    assertExists,
    getPrng,
    type GameAction
} from '@tabletop/common'
import { action, finish, start } from '../test/testSupport.js'
import { Runtime } from './definition/gameDefinition.js'
import { choicesFor, hiddenDistribution } from './distribution.js'
import { CanonicalValidator, hydrateEighteenFortySixState } from './state.js'
import type { EighteenFortySixProjectedState } from './state.js'

type State = EighteenFortySixProjectedState
type Step = { state: State; actions: GameAction[] }
const populate = Runtime.exploration?.createFromProjectedState
assertExists(populate, '1846 explores from projected views')
assertExists(Runtime.visibility)
const visibility = Runtime.visibility

function perspectives(state: State): Visibility.Perspective[] {
    return [
        ...state.players.map((player) => ({ kind: 'player' as const, playerId: player.playerId })),
        { kind: 'spectator' as const }
    ]
}
function draftCards(state: State) {
    const draft = hiddenDistribution(state)
    assertExists(draft.deck)
    return [
        ...draft.deck,
        ...draft.participants.flatMap((participant) => [
            ...(participant.packet ?? []),
            ...(participant.selections ?? []).map((selection) => selection.cardId)
        ])
    ].sort()
}
function viewOf(
    { game }: ReturnType<typeof start>,
    { state, actions }: Step,
    perspective: Visibility.Perspective
) {
    return Visibility.projectActionHistory({
        game,
        currentState: state,
        actions,
        visibility,
        perspective,
        replay: { game, runtime: Runtime }
    })
}
function sample(
    table: ReturnType<typeof start>,
    step: Step,
    perspective: Visibility.Perspective,
    seed: number,
    withoutPatches = false
): State {
    assertExists(populate)
    const view = viewOf(table, step, perspective)
    return populate({
        game: table.game,
        state: new ExplorationHistory(table.engine).prepareState(view.currentState),
        actions: withoutPatches
            ? view.actions.map(({ undoPatch: _undo, forwardPatch: _forward, ...rest }) => rest)
            : view.actions,
        perspective,
        random: getPrng(seed)
    })
}
function draftSteps(count: number, seed: number) {
    const table = start(count, seed)
    let state = table.state
    const actions: GameAction[] = []
    const steps: Step[] = []
    while (state.machineState === 'Drafting') {
        steps.push({ state, actions: [...actions] })
        const choices = choicesFor(hydrateEighteenFortySixState(state), state.activePlayerIds[0])
        const offer = hiddenDistribution(state).finalOffer
        const result = table.engine.executeCanonicalAction({
            game: table.game,
            state,
            action: action(state, offer ? undefined : choices[(steps.length * 7) % choices.length])
        })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    return { table, steps }
}
function packetOf(state: State, playerId: string) {
    const packet = hiddenDistribution(state).participants.find(
        (participant) => participant.playerId === playerId
    )?.packet
    assertExists(packet)
    return packet
}
/**
 * Cards a player passed go to the bottom of the deck in an order they never see. Until a deal
 * reaches them, the player knows which deck positions hold them; once a deal takes the front of
 * the block, the positions it has not reached still hold cards from it.
 */
function passedBlocks(steps: readonly Step[], target: number, viewerId: string) {
    const blocks: { cards: string[]; start: number }[] = []
    const { actions } = steps[target]
    for (let index = 0; index < target; index++) {
        const recorded = actions[index]
        if (recorded.type !== 'ChooseDraftCard') continue
        assert('cardId' in recorded && recorded.playerId)
        const before = steps[index].state
        const after = steps[index + 1].state
        const returned = packetOf(before, recorded.playerId).filter(
            (cardId) => cardId !== recorded.cardId
        )
        const beforeDeal = (hiddenDistribution(before).deck?.length ?? 0) + returned.length
        const dealt = beforeDeal - (hiddenDistribution(after).deck?.length ?? 0)
        for (const block of blocks) block.start -= dealt
        if (recorded.playerId === viewerId)
            blocks.push({ cards: returned, start: beforeDeal - returned.length - dealt })
    }
    return blocks.filter((block) => block.start + block.cards.length > 0)
}
function blockAt(state: State, block: { cards: string[]; start: number }) {
    return (hiddenDistribution(state).deck ?? []).slice(
        Math.max(0, block.start),
        block.start + block.cards.length
    )
}

describe('1846 exploration from a projected view', () => {
    it.each([
        [3, 7],
        [3, 41],
        [4, 22],
        [4, 31],
        [5, 2718],
        [5, 9]
    ])('deals unseen draft cards consistently for %i players (seed %i)', (count, seed) => {
        const { table, steps } = draftSteps(count, seed)
        let constrained = 0
        for (const [index, step] of steps.entries()) {
            for (const perspective of perspectives(step.state)) {
                const sampled = sample(table, step, perspective, index + 1)
                expect(CanonicalValidator.Check(sampled)).toBe(true)
                expect(draftCards(sampled)).toEqual(draftCards(step.state))
                const real = hiddenDistribution(step.state)
                const draft = hiddenDistribution(sampled)
                expect(draft.deck).toHaveLength(real.deck?.length ?? -1)
                for (const participant of draft.participants) {
                    const truth = real.participants.find(
                        (candidate) => candidate.playerId === participant.playerId
                    )
                    assertExists(truth?.packet)
                    assertExists(truth.selections)
                    expect(participant.packet).toHaveLength(truth.packet.length)
                    expect(participant.selections).toHaveLength(truth.selections.length)
                    if (
                        perspective.kind === 'player' &&
                        perspective.playerId === participant.playerId
                    ) {
                        expect(participant.packet).toEqual(truth.packet)
                        expect(participant.selections).toEqual(truth.selections)
                    }
                    const committed = (participant.selections ?? []).reduce(
                        (sum, selection) => sum + selection.price,
                        0
                    )
                    const cash = sampled.cash.find(
                        (entry) =>
                            entry.owner.kind === 'player' &&
                            entry.owner.playerId === participant.playerId
                    )?.amount
                    assert(typeof cash === 'number', 'Players hold finite cash')
                    expect(committed).toBeLessThanOrEqual(cash)
                }
                if (perspective.kind !== 'player') continue
                for (const block of passedBlocks(steps, index, perspective.playerId)) {
                    constrained++
                    for (const cardId of blockAt(step.state, block))
                        expect(block.cards).toContain(cardId)
                    for (const cardId of blockAt(sampled, block))
                        expect(block.cards).toContain(cardId)
                }
            }
        }
        expect(constrained).toBeGreaterThan(0)
    })

    it('varies what the viewer has not seen', () => {
        const { table, steps } = draftSteps(4, 22)
        const step = steps[3]
        const decks = new Set(
            Array.from({ length: 10 }, (_, seed) =>
                JSON.stringify(
                    hiddenDistribution(sample(table, step, { kind: 'spectator' }, seed)).deck
                )
            )
        )
        expect(decks.size).toBeGreaterThan(1)
    })

    it('plays a sampled draft through to the stock round', () => {
        const { table, steps } = draftSteps(4, 31)
        const step = steps[Math.floor(steps.length / 2)]
        let state = sample(table, step, { kind: 'player', playerId: 'p2' }, 5)
        while (state.machineState === 'Drafting') {
            const choices = choicesFor(
                hydrateEighteenFortySixState(state),
                state.activePlayerIds[0]
            )
            state = table.engine.executeCanonicalAction({
                game: table.game,
                state,
                action: action(state, hiddenDistribution(state).finalOffer ? undefined : choices[0])
            }).updatedState
        }
        expect(state.machineState).toBe('StockRound')
    })

    it('refuses to guess without the recorded view of earlier turns', () => {
        const { table, steps } = draftSteps(3, 7)
        expect(() => sample(table, steps[4], { kind: 'player', playerId: 'p1' }, 1, true)).toThrow(
            'recorded view'
        )
    })

    it('copies the view once the draft is revealed', () => {
        const table = finish(3, 7)
        for (const perspective of perspectives(table.state)) {
            const sampled = sample(table, table, perspective, 1)
            expect(sampled.draft).toBeUndefined()
            expect({ ...sampled, prng: undefined, protectedPrng: undefined }).toEqual({
                ...visibility.state.project(table.state, perspective),
                prng: undefined,
                protectedPrng: undefined
            })
        }
    })
})
