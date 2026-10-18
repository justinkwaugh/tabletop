import { describe, expect, it, vi } from 'vitest'
import { isCommonAction, isCommonActionType } from './actionHistory.js'
import { branchView } from './branch.js'
import { executeBranchAction } from './branchExecution.js'
import {
    executeInBranchView,
    findBranchThatWouldNotReplay,
    latestCommonActionUndoTarget,
    removeCommonAction,
    settleCommonActionRace
} from './commonAction.js'
import type { GameAction } from './gameAction.js'
import { executeInLocalGame } from './localSpan.js'
import { createSpanGame, spanAction, standingOffers, type SpanGameState } from './tests/spanGame.js'
import {
    beginSpan,
    closeOnMainLine,
    mergePrivatePlay,
    playLocally,
    playPrivately,
    playerOf,
    summary,
    type SpanGame
} from './tests/spanPlay.js'

function execute(spanGame: SpanGame, state: SpanGameState, action: GameAction) {
    return spanGame.engine.executeCanonicalAction({ game: spanGame.game, state, action })
}

const proposal = (id: string, proposerId: string, partnerId: string) =>
    spanAction(id, 'propose', proposerId, { partnerId, itemId: `start-${proposerId}` })
const acceptance = (id: string, playerId: string, offerId: string) =>
    spanAction(id, 'accept', playerId, { offerId, itemId: `start-${playerId}` })

function proposed(spanGame: SpanGame, state: SpanGameState) {
    return execute(spanGame, state, proposal('o3', 'p3', 'p2')).updatedState
}

function mergedAhead(spanGame: SpanGame, state: SpanGameState): SpanGameState {
    const ahead = playPrivately(spanGame, state, 'p3', [spanAction('f3', 'finish', 'p3')])
    return mergePrivatePlay(spanGame, state, ahead).updatedState
}

describe('Common Actions', () => {
    describe('declaration (rule 2)', () => {
        it('is an Action type whose schema requires the literal', () => {
            const { runtime } = createSpanGame()
            expect(isCommonActionType(runtime.apiActions, 'propose')).toBe(true)
            expect(isCommonActionType(runtime.apiActions, 'work')).toBe(false)
            expect(isCommonActionType(runtime.apiActions, 'shout')).toBe(false)
            expect(isCommonAction(proposal('o3', 'p3', 'p2'))).toBe(true)
            expect(isCommonAction(spanAction('w3', 'work', 'p3'))).toBe(false)
        })

        it('rejects the marker on a type that does not declare it', () => {
            const spanGame = createSpanGame()
            expect(() =>
                execute(spanGame, beginSpan(spanGame), {
                    ...spanAction('w3', 'work', 'p3'),
                    common: true
                })
            ).toThrow('Action of type work is not a Common Action')
        })

        it('is valid only during a Parallel Span', () => {
            const spanGame = createSpanGame()
            expect(() =>
                execute(spanGame, spanGame.state, spanAction('c1', 'chant', 'p1'))
            ).toThrow('A Common Action is valid only during a Parallel Span')
        })

        it('may be taken by any Player of the span, open, closed or merged, and by nobody else', () => {
            const spanGame = createSpanGame({ sitsOut: ['p2'] })
            const state = beginSpan(spanGame)
            expect(() => execute(spanGame, state, spanAction('c2', 'chant', 'p2'))).toThrow(
                'Player p2 takes no part in this span'
            )
            const open = execute(spanGame, state, spanAction('c1', 'chant', 'p1')).updatedState
            const closed = closeOnMainLine(spanGame, open, 'p1')
            const closedChanted = execute(spanGame, closed, spanAction('c1b', 'chant', 'p1'))
            expect(closedChanted.updatedState.activePlayerIds).toEqual(['p3'])
            const merged = mergedAhead(spanGame, closedChanted.updatedState)
            expect(merged.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
            expect(
                execute(spanGame, merged, spanAction('c3', 'chant', 'p3')).updatedState.log
            ).toEqual(['span', 'chant:p1', 'chant:p1', 'chant:p3'])
        })
    })

    describe('handling in the Branching Machine State (rule 3)', () => {
        it('is validated and handled there, and changes neither the Active Players nor the span record', () => {
            const spanGame = createSpanGame()
            const state = beginSpan(spanGame)
            const entry = vi.spyOn(spanGame.runtime.stateHandlers.branching, 'enter')
            const executed = execute(spanGame, state, proposal('o3', 'p3', 'p2'))
            expect(summary(executed.processedActions)).toEqual(['propose:p3'])
            expect(executed.updatedState.machineState).toBe('branching')
            expect(executed.updatedState.offers).toEqual({
                o3: { proposerId: 'p3', partnerId: 'p2', itemId: 'start-p3', agreed: false }
            })
            expect(executed.updatedState.activePlayerIds).toEqual(state.activePlayerIds)
            expect(executed.updatedState.parallelSpan).toEqual(state.parallelSpan)
            expect(executed.updatedState.actionCount).toBe(state.actionCount + 1)
            expect(entry).toHaveBeenCalledTimes(1)
            expect(() =>
                execute(
                    spanGame,
                    state,
                    spanAction('o9', 'propose', 'p3', { partnerId: 'p3', itemId: 'start-p3' })
                )
            ).toThrow('not valid in state branching')
        })

        it('may pass through other Machine States as long as it returns', () => {
            const spanGame = createSpanGame({ commonCascade: 'announces' })
            const executed = execute(spanGame, beginSpan(spanGame), spanAction('c2', 'chant', 'p2'))
            expect(summary(executed.processedActions)).toEqual(['chant:p2', 'announce:'])
            expect(executed.actionCascade.transitions[0].after.machineState).toBe('announcing')
            expect(executed.updatedState.machineState).toBe('branching')
            expect(executed.updatedState.log).toEqual(['span', 'chant:p2', 'announced'])
        })

        it('is rejected when its cascade does not return', () => {
            const spanGame = createSpanGame({ commonCascade: 'strays' })
            expect(() =>
                execute(spanGame, beginSpan(spanGame), spanAction('c2', 'chant', 'p2'))
            ).toThrow('A Common Action must return to the Branching Machine State')
        })

        it('is rejected when it returns with a System Action still waiting', () => {
            const spanGame = createSpanGame({ commonCascade: 'returnsWithPending' })
            expect(() =>
                execute(spanGame, beginSpan(spanGame), spanAction('c2', 'chant', 'p2'))
            ).toThrow(
                'A Common Action must end its cascade when it returns to the Branching Machine State'
            )
        })
    })

    describe('the inverted Branch Scope check (rule 4)', () => {
        it('rejects a change inside an object that carries a Player’s identity', () => {
            const spanGame = createSpanGame()
            expect(() =>
                execute(
                    spanGame,
                    beginSpan(spanGame),
                    spanAction('n2', 'nudge', 'p2', { otherPlayerId: 'p3' })
                )
            ).toThrow(/A Common Action may not change \/players/)
        })

        it('rejects writing a Player’s identity onto a record in the Common Scope', () => {
            const spanGame = createSpanGame()
            expect(() =>
                execute(spanGame, beginSpan(spanGame), spanAction('l2', 'plant', 'p2'))
            ).toThrow('A Common Action may not change /flag/playerId')
        })

        it('rejects adding a record that holds objects carrying Players’ identities inside it', () => {
            const spanGame = createSpanGame()
            expect(() =>
                execute(
                    spanGame,
                    beginSpan(spanGame),
                    spanAction('e2', 'enlist', 'p2', { partnerId: 'p3' })
                )
            ).toThrow('A Common Action may not change /crews/e2')
        })

        it('allows changes to shared collections, addressed by position or not', () => {
            const spanGame = createSpanGame()
            const chanted = execute(spanGame, beginSpan(spanGame), spanAction('c2', 'chant', 'p2'))
            expect(chanted.updatedState.log).toEqual(['span', 'chant:p2'])
        })
    })

    describe('reading the acting Player’s own side (rule 5)', () => {
        it('checks what the Player offers against their Branch View, where it may already be used up', () => {
            const spanGame = createSpanGame()
            const state = beginSpan(spanGame)
            const dropped = playPrivately(spanGame, state, 'p2', [
                spanAction('d2', 'drop', 'p2', { itemId: 'start-p2' })
            ])
            const offer = proposal('o2', 'p2', 'p3')
            expect(() =>
                executeInBranchView({ ...spanGame, state, branch: dropped.branch, action: offer })
            ).toThrow('not valid in state branching')
            expect(execute(spanGame, state, offer).updatedState.offers.o2).toBeDefined()

            const working = playPrivately(spanGame, state, 'p2', [spanAction('w2', 'work', 'p2')])
            const inView = executeInBranchView({
                ...spanGame,
                state,
                branch: working.branch,
                action: offer
            })
            expect(summary(inView.processedActions)).toEqual(['propose:p2'])
            expect(inView.updatedState.offers.o2).toBeDefined()
            expect(inView.updatedState.machineState).toBe('working')
            expect(inView.updatedState.parallelSpan?.branchPlayerId).toBe('p2')
            expect(playerOf(inView.updatedState, 'p2').work).toBe(1)
        })
    })

    describe('consequences settle after the span (rule 6)', () => {
        it('is not changed by a Branch Close, but lapses when a named Player closes', () => {
            const spanGame = createSpanGame()
            const state = proposed(spanGame, beginSpan(spanGame))
            const closed = closeOnMainLine(spanGame, state, 'p3')
            expect(closed.offers).toEqual(state.offers)
            expect(standingOffers(state)).toHaveLength(1)
            expect(standingOffers(closed)).toEqual([])
            expect(() => execute(spanGame, closed, acceptance('a2', 'p2', 'o3'))).toThrow(
                'not valid in state branching'
            )
        })

        it('releases what a lapsed offer held', () => {
            const spanGame = createSpanGame()
            const state = proposed(spanGame, beginSpan(spanGame))
            const drop = spanAction('d3', 'drop', 'p3', { itemId: 'start-p3' })
            expect(() => playPrivately(spanGame, state, 'p3', [drop])).toThrow(
                'not valid in state working'
            )
            const partnerClosed = closeOnMainLine(spanGame, state, 'p2')
            expect(
                playPrivately(spanGame, partnerClosed, 'p3', [drop]).view.items['start-p3']
            ).toBeUndefined()
        })

        it('settles agreed offers at Span Completion', () => {
            const spanGame = createSpanGame()
            const played = playLocally(spanGame, beginSpan(spanGame), [
                proposal('o1', 'p1', 'p2'),
                acceptance('a2', 'p2', 'o1'),
                spanAction('f3', 'finish', 'p3'),
                spanAction('f2', 'finish', 'p2'),
                spanAction('f1', 'finish', 'p1')
            ])
            expect(played.state.machineState).toBe('scoring')
            expect(played.state.offers).toEqual({})
            expect(played.state.items['start-p1'].playerId).toBe('p2')
            expect(played.state.items['start-p2'].playerId).toBe('p1')
            expect(played.state.items['start-p3'].playerId).toBe('p3')
        })
    })

    describe('what a Branch may rely on (rule 7)', () => {
        it('is held back by what its Player pledged until the offer is withdrawn', () => {
            const spanGame = createSpanGame()
            const state = proposed(spanGame, beginSpan(spanGame))
            const drop = spanAction('d3', 'drop', 'p3', { itemId: 'start-p3' })
            expect(() => playPrivately(spanGame, state, 'p3', [drop])).toThrow(
                'not valid in state working'
            )
            const withdrawn = execute(
                spanGame,
                state,
                spanAction('x3', 'withdraw', 'p3', { offerId: 'o3' })
            )
            expect(withdrawn.updatedState.offers).toEqual({})
            expect(
                playPrivately(spanGame, withdrawn.updatedState, 'p3', [drop]).view.items['start-p3']
            ).toBeUndefined()
        })

        it('holds what the partner pledged once they accept, and the agreement cannot be withdrawn', () => {
            const spanGame = createSpanGame()
            const state = proposed(spanGame, beginSpan(spanGame))
            const accepted = execute(spanGame, state, acceptance('a2', 'p2', 'o3'))
            expect(accepted.processedActions[0].revealsInfo).toBe(true)
            expect(accepted.updatedState.offers.o3).toMatchObject({
                agreed: true,
                partnerItemId: 'start-p2'
            })
            expect(() =>
                playPrivately(spanGame, accepted.updatedState, 'p2', [
                    spanAction('d2', 'drop', 'p2', { itemId: 'start-p2' })
                ])
            ).toThrow('not valid in state working')
            expect(() =>
                execute(
                    spanGame,
                    accepted.updatedState,
                    spanAction('x3', 'withdraw', 'p3', { offerId: 'o3' })
                )
            ).toThrow('not valid in state branching')
        })

        it('may rely on an agreed offer, which nothing can change before Span Completion', () => {
            const spanGame = createSpanGame()
            const agreed = execute(
                spanGame,
                proposed(spanGame, beginSpan(spanGame)),
                acceptance('a2', 'p2', 'o3')
            ).updatedState
            const hopeful = playPrivately(spanGame, agreed, 'p2', [
                spanAction('h2', 'hope', 'p2'),
                spanAction('f2', 'finish', 'p2')
            ])
            expect(playerOf(hopeful.view, 'p2').work).toBe(1)
            const merged = mergePrivatePlay(spanGame, mergedAhead(spanGame, agreed), hopeful)
            expect(playerOf(merged.updatedState, 'p2').work).toBe(1)
        })

        it('is refused at the Merge when it relied on a pending offer that was withdrawn', () => {
            const spanGame = createSpanGame()
            const state = proposed(spanGame, beginSpan(spanGame))
            const hopeful = playPrivately(spanGame, state, 'p2', [
                spanAction('h2', 'hope', 'p2'),
                spanAction('f2', 'finish', 'p2')
            ])
            expect(playerOf(hopeful.view, 'p2').work).toBe(1)
            const withdrawn = execute(
                spanGame,
                state,
                spanAction('x3', 'withdraw', 'p3', { offerId: 'o3' })
            ).updatedState
            expect(() =>
                mergePrivatePlay(spanGame, mergedAhead(spanGame, withdrawn), hopeful)
            ).toThrow(
                'The Branch of p2 cannot be merged: it reached a different Game State on the Main Line'
            )
        })
    })

    describe('Undo (rule 9)', () => {
        function mainLineWith(
            spanGame: SpanGame,
            state: SpanGameState,
            steps: readonly GameAction[]
        ) {
            const history: GameAction[] = []
            let current = state
            for (const step of steps) {
                const executed = execute(spanGame, current, step)
                history.push(...executed.processedActions)
                current = executed.updatedState
            }
            return { state: current, history }
        }

        it('offers a Player their own latest Common Action until another Player’s follows it', () => {
            const spanGame = createSpanGame()
            const begun = beginSpan(spanGame)
            const span = begun.parallelSpan
            if (span === undefined) throw Error('No span')
            const first = mainLineWith(spanGame, begun, [proposal('o3', 'p3', 'p2')])
            expect(latestCommonActionUndoTarget(first.history, span, 'p3')?.id).toBe('o3')
            expect(latestCommonActionUndoTarget(first.history, span, 'p2')).toBeUndefined()

            const closed = closeOnMainLine(spanGame, first.state, 'p1')
            const close = spanGame.engine.closeBranch({
                state: first.state,
                playerId: 'p1'
            }).processedActions
            const second = mainLineWith(spanGame, closed, [spanAction('c2', 'chant', 'p2')])
            const history = [...first.history, ...close, ...second.history]
            expect(latestCommonActionUndoTarget(history, span, 'p2')?.id).toBe('c2')
            expect(latestCommonActionUndoTarget(history, span, 'p3')).toBeUndefined()
            expect(latestCommonActionUndoTarget([...first.history, ...close], span, 'p3')?.id).toBe(
                'o3'
            )
        })

        it('never offers an Information-Revealing Common Action', () => {
            const spanGame = createSpanGame()
            const begun = beginSpan(spanGame)
            const span = begun.parallelSpan
            if (span === undefined) throw Error('No span')
            const { history } = mainLineWith(spanGame, begun, [
                proposal('o3', 'p3', 'p2'),
                acceptance('a2', 'p2', 'o3')
            ])
            expect(latestCommonActionUndoTarget(history, span, 'p2')).toBeUndefined()
            expect(latestCommonActionUndoTarget(history, span, 'p3')).toBeUndefined()
        })

        it('takes the Common Action out and replays the Branch Closes and Merges that followed', () => {
            const spanGame = createSpanGame()
            const begun = beginSpan(spanGame)
            const ahead = playPrivately(spanGame, begun, 'p3', [
                spanAction('w3', 'work', 'p3'),
                spanAction('f3', 'finish', 'p3')
            ])
            const record = (
                steps: ((state: SpanGameState) => {
                    processedActions: GameAction[]
                    updatedState: SpanGameState
                })[]
            ) => {
                const history: GameAction[] = []
                let state = begun
                for (const step of steps) {
                    const result = step(state)
                    history.push(...result.processedActions)
                    state = result.updatedState
                }
                return { state, history }
            }
            const closeAndMerge = [
                (state: SpanGameState) => spanGame.engine.closeBranch({ state, playerId: 'p2' }),
                (state: SpanGameState) => spanGame.engine.closeBranch({ state, playerId: 'p3' }),
                (state: SpanGameState) => mergePrivatePlay(spanGame, state, ahead)
            ]
            const withOffer = record([
                (state) => execute(spanGame, state, proposal('o3', 'p3', 'p2')),
                ...closeAndMerge
            ])
            const without = record(closeAndMerge)
            expect(summary(withOffer.history)).toEqual([
                'propose:p3',
                'closeBranch:p2',
                'closeBranch:p3',
                'openBranch:p3',
                'work:p3',
                'finish:p3'
            ])

            const undone = removeCommonAction({
                ...spanGame,
                state: withOffer.state,
                history: withOffer.history,
                actionId: 'o3'
            })
            expect(summary(undone.removed)).toEqual(summary(withOffer.history))
            expect(summary(undone.replayed)).toEqual(summary(withOffer.history).slice(1))
            expect(undone.replayed.map((action) => action.id)).toEqual(
                withOffer.history.slice(1).map((action) => action.id)
            )
            expect(undone.replayed.map((action) => action.index)).toEqual(
                without.history.map((action) => action.index)
            )
            expect(undone.state).toEqual(without.state)
        })
    })

    describe('races in a Hosted Game (rule 10)', () => {
        function race(
            spanGame: SpanGame,
            origin: SpanGameState,
            between: GameAction[],
            state: SpanGameState,
            late: GameAction
        ) {
            return settleCommonActionRace({
                ...spanGame,
                state,
                raced: between,
                late: { ...late, index: origin.actionCount }
            })
        }

        it('is executed again when only Branch Closes and Merges came between, and makes the same changes', () => {
            const spanGame = createSpanGame()
            const origin = beginSpan(spanGame)
            const closed = spanGame.engine.closeBranch({ state: origin, playerId: 'p1' })
            expect(
                race(
                    spanGame,
                    origin,
                    closed.processedActions,
                    closed.updatedState,
                    proposal('o2', 'p2', 'p3')
                )
            ).toEqual({ kind: 'commutes' })
            const closedAhead = spanGame.engine.closeBranch({
                state: closed.updatedState,
                playerId: 'p3'
            })
            const merged = mergePrivatePlay(
                spanGame,
                closedAhead.updatedState,
                playPrivately(spanGame, origin, 'p3', [spanAction('f3', 'finish', 'p3')])
            )
            const between = [
                ...closed.processedActions,
                ...closedAhead.processedActions,
                ...merged.processedActions
            ]
            expect(summary(between)).toEqual([
                'closeBranch:p1',
                'closeBranch:p3',
                'openBranch:p3',
                'finish:p3'
            ])
            expect(
                race(
                    spanGame,
                    origin,
                    between,
                    merged.updatedState,
                    spanAction('c2', 'chant', 'p2')
                )
            ).toEqual({ kind: 'commutes' })
        })

        it('is refused when a Branch Close it raced made it lapse', () => {
            const spanGame = createSpanGame()
            const origin = beginSpan(spanGame)
            const closed = spanGame.engine.closeBranch({ state: origin, playerId: 'p3' })
            const outcome = race(
                spanGame,
                origin,
                closed.processedActions,
                closed.updatedState,
                proposal('o2', 'p2', 'p3')
            )
            expect(outcome).toMatchObject({
                kind: 'invalid',
                reason: expect.stringContaining('not valid')
            })
        })

        it('is recorded after another Player’s Common Action when the Commutation Proof succeeds', () => {
            const spanGame = createSpanGame()
            const origin = beginSpan(spanGame)
            const chanted = execute(spanGame, origin, spanAction('c3', 'chant', 'p3'))
            expect(
                race(
                    spanGame,
                    origin,
                    chanted.processedActions,
                    chanted.updatedState,
                    proposal('o2', 'p2', 'p1')
                )
            ).toEqual({ kind: 'commutes' })
            expect(
                race(
                    spanGame,
                    origin,
                    chanted.processedActions,
                    chanted.updatedState,
                    spanAction('c3b', 'chant', 'p3')
                )
            ).toEqual({
                kind: 'invalid',
                reason: 'the Player already acted since that position'
            })
        })

        it('always refuses an Information-Revealing Common Action raced by another Player’s', () => {
            const spanGame = createSpanGame()
            const origin = proposed(spanGame, beginSpan(spanGame))
            const chanted = execute(spanGame, origin, spanAction('c1', 'chant', 'p1'))
            expect(
                race(
                    spanGame,
                    origin,
                    chanted.processedActions,
                    chanted.updatedState,
                    acceptance('a2', 'p2', 'o3')
                )
            ).toEqual({
                kind: 'invalid',
                reason: 'an involved Action reveals information'
            })
            const closed = spanGame.engine.closeBranch({ state: origin, playerId: 'p1' })
            expect(
                race(
                    spanGame,
                    origin,
                    closed.processedActions,
                    closed.updatedState,
                    acceptance('a2', 'p2', 'o3')
                )
            ).toEqual({ kind: 'commutes' })
        })

        it('is refused once the span has completed', () => {
            const spanGame = createSpanGame({ idle: ['p1', 'p2', 'p3'] })
            const origin = beginSpan(spanGame)
            const completed = playLocally(spanGame, origin, [])
            expect(
                race(
                    spanGame,
                    origin,
                    completed.processedActions,
                    completed.state,
                    spanAction('c2', 'chant', 'p2')
                )
            ).toEqual({
                kind: 'invalid',
                reason: 'the span has completed'
            })
        })
    })

    describe('an administrator’s Undo over an agreement (rule 9)', () => {
        it('refuses when an Unmerged Branch would not replay the same on the Main Line it leaves', () => {
            const spanGame = createSpanGame()
            const begun = beginSpan(spanGame)
            const agreed = execute(
                spanGame,
                proposed(spanGame, begun),
                acceptance('a2', 'p2', 'o3')
            ).updatedState
            const relying = playPrivately(spanGame, agreed, 'p2', [spanAction('h2', 'hope', 'p2')])
            const heldBack = playPrivately(spanGame, agreed, 'p3', [spanAction('w3', 'work', 'p3')])
            expect(
                findBranchThatWouldNotReplay({
                    ...spanGame,
                    state: agreed,
                    unmergedBranches: [relying, heldBack]
                })
            ).toBeUndefined()
            expect(
                findBranchThatWouldNotReplay({
                    ...spanGame,
                    state: begun,
                    unmergedBranches: [heldBack, relying]
                })
            ).toEqual({
                playerId: 'p2',
                reason: 'hope would have a different result'
            })
        })
    })

    describe('Local Games (rule 12)', () => {
        function midBranch(options = {}) {
            const spanGame = createSpanGame(options)
            const inBranch = playLocally(spanGame, beginSpan(spanGame), [
                spanAction('w3', 'work', 'p3')
            ])
            return { spanGame, inBranch }
        }

        it('sets the open Branch aside, runs the Common Action in the Branching Machine State, and puts the Branch back', () => {
            const { spanGame, inBranch } = midBranch()
            const entry = vi.spyOn(spanGame.runtime.stateHandlers.branching, 'enter')
            const result = executeInLocalGame({
                ...spanGame,
                state: inBranch.state,
                action: proposal('o2', 'p2', 'p1')
            })
            expect(summary(result.processedActions)).toEqual(['propose:p2'])
            expect(entry).toHaveBeenCalledTimes(1)
            const after = result.updatedState
            expect(after.offers.o2).toMatchObject({ proposerId: 'p2', partnerId: 'p1' })
            expect(after.machineState).toBe('working')
            expect(after.activePlayerIds).toEqual(['p3'])
            expect(after.parallelSpan).toEqual(inBranch.state.parallelSpan)
            expect(playerOf(after, 'p3').work).toBe(1)
        })

        it('keeps the Branch set aside while the cascade passes through another Machine State', () => {
            const { spanGame, inBranch } = midBranch({ commonCascade: 'announces' })
            const result = executeInLocalGame({
                ...spanGame,
                state: inBranch.state,
                action: spanAction('c2', 'chant', 'p2')
            })
            expect(summary(result.processedActions)).toEqual(['chant:p2', 'announce:'])
            const midway = result.actionCascade.transitions[0].after
            expect(midway.machineState).toBe('announcing')
            expect(midway.activePlayerIds).toEqual(['p3', 'p2', 'p1'])
            expect(midway.parallelSpan?.branchPlayerId).toBeUndefined()
            expect(midway.parallelSpan?.branchSetAside).toEqual({
                playerId: 'p3',
                machineState: 'working'
            })
            expect(result.updatedState.machineState).toBe('working')
            expect(result.updatedState.parallelSpan).toEqual(inBranch.state.parallelSpan)
        })

        it('is recorded among the Branch’s Actions but checked as a Common Action', () => {
            const { spanGame, inBranch } = midBranch()
            expect(() => execute(spanGame, inBranch.state, spanAction('g3', 'grab', 'p3'))).toThrow(
                /The Branch of p3 may not change \/pot/
            )
            expect(() =>
                execute(
                    spanGame,
                    inBranch.state,
                    spanAction('n2', 'nudge', 'p2', { otherPlayerId: 'p1' })
                )
            ).toThrow(/A Common Action may not change \/players/)
            expect(
                execute(spanGame, inBranch.state, spanAction('c2', 'chant', 'p2')).updatedState.log
            ).toEqual(['span', 'chant:p2'])
        })

        it('replays as a run of its own, and is reversed whole by its undo patches', () => {
            const { spanGame, inBranch } = midBranch({ commonCascade: 'announces' })
            const result = execute(spanGame, inBranch.state, spanAction('c2', 'chant', 'p2'))
            const [chant, announce] = result.processedActions
            const replayed = spanGame.engine.executeSingleAction({
                ...spanGame,
                state: inBranch.state,
                action: chant
            })
            expect(replayed.updatedState).toEqual(result.actionCascade.transitions[0].after)
            const { undoPatch: _chantPatch, ...chantRecord } = chant
            const { undoPatch: _announcePatch, ...announceRecord } = announce
            const applied = spanGame.engine.applyProcessedAction({
                ...spanGame,
                state: spanGame.engine.applyProcessedAction({
                    ...spanGame,
                    state: inBranch.state,
                    action: chantRecord
                }),
                action: announceRecord
            })
            expect(applied).toEqual(result.updatedState)
            let reversed = result.updatedState
            for (const action of result.processedActions.toReversed()) {
                reversed = spanGame.engine.undoProcessedAction({ action, state: reversed })
            }
            expect(reversed).toEqual(inBranch.state)
        })

        it('lets the Player whose Branch is open, or is done, take one too', () => {
            const { spanGame, inBranch } = midBranch()
            const own = executeInLocalGame({
                ...spanGame,
                state: inBranch.state,
                action: proposal('o3', 'p3', 'p2')
            })
            expect(own.updatedState.parallelSpan?.branchPlayerId).toBe('p3')
            expect(own.updatedState.machineState).toBe('working')
            const next = executeInLocalGame({
                ...spanGame,
                state: own.updatedState,
                action: spanAction('f3', 'finish', 'p3')
            })
            expect(next.updatedState.parallelSpan?.branchPlayerId).toBe('p2')
            const done = executeInLocalGame({
                ...spanGame,
                state: next.updatedState,
                action: spanAction('c3', 'chant', 'p3')
            })
            expect(done.updatedState.log).toEqual(['span', 'chant:p3'])
            expect(done.updatedState.parallelSpan?.branchPlayerId).toBe('p2')
        })

        it('reaches what a Hosted Game reaches with the same Actions', () => {
            const steps = {
                p3: [spanAction('w3', 'work', 'p3'), spanAction('f3', 'finish', 'p3')],
                p2: [
                    spanAction('w2', 'work', 'p2'),
                    spanAction('w2b', 'work', 'p2'),
                    spanAction('f2', 'finish', 'p2')
                ],
                p1: [
                    spanAction('s1', 'stash', 'p1', { label: 'new' }),
                    spanAction('f1', 'finish', 'p1')
                ]
            }
            const offer = proposal('o1', 'p1', 'p2')
            const agreement = acceptance('a2', 'p2', 'o1')

            const hosted = createSpanGame()
            const branchPoint = beginSpan(hosted)
            const plays = Object.fromEntries(
                Object.entries(steps).map(([playerId, actions]) => [
                    playerId,
                    playPrivately(hosted, branchPoint, playerId, actions)
                ])
            )
            let mainLine = execute(hosted, branchPoint, offer).updatedState
            mainLine = mergePrivatePlay(hosted, mainLine, plays.p3).updatedState
            mainLine = execute(hosted, mainLine, agreement).updatedState
            mainLine = mergePrivatePlay(hosted, mainLine, plays.p2).updatedState
            mainLine = mergePrivatePlay(hosted, mainLine, plays.p1).updatedState
            mainLine = hosted.engine.completeSpan({
                game: hosted.game,
                state: mainLine
            }).updatedState

            const played = playLocally(hosted, branchPoint, [
                offer,
                ...steps.p3,
                agreement,
                ...steps.p2,
                ...steps.p1
            ])

            expect(mainLine.machineState).toBe('scoring')
            expect(mainLine.items['start-p1'].playerId).toBe('p2')
            expect({ ...mainLine, actionChecksum: 0 }).toEqual({
                ...played.state,
                actionChecksum: 0
            })
        })
    })

    describe('available actions (rule 13)', () => {
        function offered(spanGame: SpanGame, state: SpanGameState, playerId: string) {
            return spanGame.engine.getValidActionTypesForPlayer(spanGame.game, state, playerId)
        }

        it('offers every Player of the span the Common Action types the title says they may take now', () => {
            const spanGame = createSpanGame()
            const state = beginSpan(spanGame)
            expect(offered(spanGame, state, 'p2')).toEqual(['propose', 'chant'])
            const withOffer = proposed(spanGame, state)
            expect(offered(spanGame, withOffer, 'p2')).toEqual(['propose', 'chant', 'accept'])
            expect(offered(spanGame, withOffer, 'p3')).toEqual(['propose', 'chant', 'withdraw'])
            expect(offered(spanGame, closeOnMainLine(spanGame, withOffer, 'p1'), 'p1')).toEqual([
                'propose',
                'chant'
            ])
            expect(offered(spanGame, mergedAhead(spanGame, state), 'p3')).toEqual([
                'propose',
                'chant'
            ])
        })

        it('offers nothing to a Player outside the span', () => {
            const spanGame = createSpanGame({ sitsOut: ['p2'] })
            expect(offered(spanGame, beginSpan(spanGame), 'p2')).toEqual([])
        })

        it('offers them beside the Branch’s own Actions in the Player’s Branch View', () => {
            const spanGame = createSpanGame()
            const state = beginSpan(spanGame)
            const open = branchView(state, playPrivately(spanGame, state, 'p2', []).branch)
            expect(offered(spanGame, open, 'p2')).toEqual([
                'work',
                'roll',
                'finish',
                'propose',
                'chant'
            ])
            const closed = branchView(
                state,
                playPrivately(spanGame, state, 'p2', [spanAction('f2', 'finish', 'p2')]).branch
            )
            expect(offered(spanGame, closed, 'p2')).toEqual(['propose', 'chant'])
        })

        it('offers them to the Players who are not acting in a Local Game', () => {
            const spanGame = createSpanGame()
            const inBranch = playLocally(spanGame, beginSpan(spanGame), []).state
            expect(offered(spanGame, inBranch, 'p3')).toEqual([
                'work',
                'roll',
                'finish',
                'propose',
                'chant'
            ])
            expect(offered(spanGame, inBranch, 'p2')).toEqual(['propose', 'chant'])
        })

        it('rejects a Branch Action from a Player who may only take Common Actions', () => {
            const spanGame = createSpanGame()
            const state = beginSpan(spanGame)
            const closed = closeOnMainLine(spanGame, state, 'p2')
            expect(() => execute(spanGame, closed, spanAction('w2', 'work', 'p2'))).toThrow(
                'No User Action is valid in a Branching Machine State'
            )
            const theirs = playPrivately(spanGame, state, 'p3', [])
            expect(() =>
                executeBranchAction({
                    ...spanGame,
                    state,
                    branch: theirs.branch,
                    action: spanAction('w2', 'work', 'p2')
                })
            ).toThrow('not an active player')
        })
    })
})
