import { describe, expect, it } from 'vitest'
import type { UnmergedBranch } from './branch.js'
import { createGameFork } from './gameFork.js'
import { reverseToBranchStart, settleSpan } from './hostedSpan.js'
import { createSpanGame, spanAction, type SpanGameOptions } from './tests/spanGame.js'
import {
    beginSpan,
    playLocally,
    playPrivately,
    playerOf,
    summary,
    type SpanGame
} from './tests/spanPlay.js'

function closedBranch(
    spanGame: SpanGame,
    state: ReturnType<typeof beginSpan>,
    playerId: string
): UnmergedBranch {
    return playPrivately(spanGame, state, playerId, [
        spanAction(`f-${playerId}`, 'finish', playerId)
    ])
}

function openBranch(
    spanGame: SpanGame,
    state: ReturnType<typeof beginSpan>,
    playerId: string
): UnmergedBranch {
    return playPrivately(spanGame, state, playerId, [])
}

function settle(
    spanGame: SpanGame,
    state: ReturnType<typeof beginSpan>,
    unmergedBranches: readonly UnmergedBranch[],
    held = false
) {
    return settleSpan({
        engine: spanGame.engine,
        game: spanGame.game,
        state,
        unmergedBranches,
        held
    })
}

function begun(options: SpanGameOptions = {}) {
    const spanGame = createSpanGame(options)
    return { spanGame, state: beginSpan(spanGame) }
}

describe('Settling a span on the host', () => {
    it('creates a Branch for each Player when the span begins, and leaves the Main Line alone', () => {
        const { spanGame, state } = begun()
        const settlement = settle(spanGame, state, [])
        expect(settlement.createdBranches.map(({ branch }) => branch.playerId)).toEqual([
            'p3',
            'p2',
            'p1'
        ])
        expect(settlement.createdBranches.map(({ actions }) => summary(actions))).toEqual([
            ['openBranch:p3'],
            ['openBranch:p2'],
            ['openBranch:p1']
        ])
        expect(settlement.processedActions).toEqual([])
        expect(settlement.mergedPlayerIds).toEqual([])
        expect(settlement.updatedState).toEqual(state)
    })

    it('creates no Branch for a Player the span does not include', () => {
        const { spanGame, state } = begun({ sitsOut: ['p2'] })
        const settlement = settle(spanGame, state, [])
        expect(settlement.createdBranches.map(({ branch }) => branch.playerId)).toEqual([
            'p3',
            'p1'
        ])
    })

    it('merges at once a Branch that closes on Branch Start', () => {
        const { spanGame, state } = begun({ idle: ['p3'] })
        const settlement = settle(spanGame, state, [])
        expect(summary(settlement.processedActions)).toEqual(['openBranch:p3', 'idleSkip:p3'])
        expect(settlement.mergedPlayerIds).toEqual(['p3'])
        expect(settlement.createdBranches.map(({ branch }) => branch.playerId)).toEqual([
            'p2',
            'p1'
        ])
        expect(settlement.updatedState.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
    })

    it('runs a span nobody needs to act in straight through to Span Completion', () => {
        const { spanGame, state } = begun({ idle: ['p1', 'p2', 'p3'] })
        const settlement = settle(spanGame, state, [])
        expect(summary(settlement.processedActions).at(-1)).toBe('complete:')
        expect(settlement.updatedState.machineState).toBe('scoring')
        expect(settlement.createdBranches).toEqual([])
        expect(settlement.mergedPlayerIds).toEqual(['p3', 'p2', 'p1'])
    })

    it('does not merge a Closed Branch while a Branch ahead of it is open', () => {
        const { spanGame, state } = begun()
        const settlement = settle(spanGame, state, [
            openBranch(spanGame, state, 'p3'),
            closedBranch(spanGame, state, 'p2'),
            openBranch(spanGame, state, 'p1')
        ])
        expect(settlement.processedActions).toEqual([])
        expect(settlement.mergedPlayerIds).toEqual([])
        expect(settlement.createdBranches).toEqual([])
    })

    it('merges every Closed Branch that is ready, in Merge Order', () => {
        const { spanGame, state } = begun()
        const settlement = settle(spanGame, state, [
            closedBranch(spanGame, state, 'p2'),
            closedBranch(spanGame, state, 'p3'),
            openBranch(spanGame, state, 'p1')
        ])
        expect(settlement.mergedPlayerIds).toEqual(['p3', 'p2'])
        expect(summary(settlement.processedActions)).toEqual([
            'openBranch:p3',
            'finish:p3',
            'openBranch:p2',
            'finish:p2'
        ])
        expect(settlement.processedActions.map((action) => action.index)).toEqual([1, 2, 3, 4])
        expect(settlement.actionCascade.before).toEqual(state)
        expect(settlement.actionCascade.transitions).toHaveLength(4)
    })

    it('completes the span when the last Branch is merged', () => {
        const { spanGame, state } = begun()
        const settlement = settle(spanGame, state, [
            closedBranch(spanGame, state, 'p1'),
            closedBranch(spanGame, state, 'p2'),
            closedBranch(spanGame, state, 'p3')
        ])
        expect(settlement.mergedPlayerIds).toEqual(['p3', 'p2', 'p1'])
        expect(settlement.processedActions.at(-1)?.type).toBe('complete')
        expect(settlement.updatedState.parallelSpan).toBeUndefined()
    })

    it('creates the next span’s Branches when Span Completion leads straight into another span', () => {
        const { spanGame, state } = begun({ spans: 2 })
        const settlement = settle(spanGame, state, [
            closedBranch(spanGame, state, 'p1'),
            closedBranch(spanGame, state, 'p2'),
            closedBranch(spanGame, state, 'p3')
        ])
        expect(settlement.mergedPlayerIds).toEqual(['p3', 'p2', 'p1'])
        expect(summary(settlement.processedActions).slice(-2)).toEqual(['complete:', 'nextSpan:'])
        expect(settlement.updatedState.parallelSpan?.mergedPlayerIds).toEqual([])
        expect(settlement.updatedState.parallelSpan?.branchPoint).not.toEqual(
            state.parallelSpan?.branchPoint
        )
        expect(settlement.createdBranches.map(({ branch }) => branch.playerId)).toEqual([
            'p3',
            'p2',
            'p1'
        ])
        expect(settlement.createdBranches[0].branch.branchPoint).toEqual(
            settlement.updatedState.parallelSpan?.branchPoint
        )
    })

    it('holds every Branch back under a Barrier Merge until all are closed', () => {
        const { spanGame, state } = begun({ merge: 'barrier' })
        const closedSoFar = [
            closedBranch(spanGame, state, 'p3'),
            closedBranch(spanGame, state, 'p2')
        ]
        const waiting = settle(spanGame, state, [...closedSoFar, openBranch(spanGame, state, 'p1')])
        expect(waiting.mergedPlayerIds).toEqual([])
        const all = settle(spanGame, state, [...closedSoFar, closedBranch(spanGame, state, 'p1')])
        expect(all.mergedPlayerIds).toEqual(['p3', 'p2', 'p1'])
    })

    it('stops at a Branch whose Merge is refused, keeping the Merges before it', () => {
        const { spanGame, state } = begun()
        const dependent = playPrivately(spanGame, state, 'p2', [
            spanAction('k2', 'peek', 'p2', { otherPlayerId: 'p3' }),
            spanAction('f2', 'finish', 'p2')
        ])
        const ahead = playPrivately(spanGame, state, 'p3', [
            spanAction('w3', 'work', 'p3'),
            spanAction('f3', 'finish', 'p3')
        ])
        const settlement = settle(spanGame, state, [
            dependent,
            ahead,
            openBranch(spanGame, state, 'p1')
        ])
        expect(settlement.mergedPlayerIds).toEqual(['p3'])
        expect(settlement.refusal).toEqual({
            playerId: 'p2',
            reason: 'The Branch of p2 cannot be merged: it reached a different Game State on the Main Line'
        })
        expect(playerOf(settlement.updatedState, 'p3').work).toBe(1)
        expect(settlement.updatedState.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
    })

    it('attempts no Merge while the span is held', () => {
        const { spanGame, state } = begun()
        const settlement = settle(
            spanGame,
            state,
            [closedBranch(spanGame, state, 'p3'), openBranch(spanGame, state, 'p2')],
            true
        )
        expect(settlement.mergedPlayerIds).toEqual([])
        expect(settlement.createdBranches.map(({ branch }) => branch.playerId)).toEqual(['p1'])
    })

    it('ignores a stored Branch that belongs to another span, and starts that Player afresh', () => {
        const { spanGame, state } = begun()
        const stale = closedBranch(spanGame, state, 'p3')
        const settlement = settle(spanGame, state, [
            {
                ...stale,
                branch: { ...stale.branch, branchPoint: { actionCount: 99, actionChecksum: 1 } }
            }
        ])
        expect(settlement.mergedPlayerIds).toEqual([])
        expect(settlement.createdBranches.map(({ branch }) => branch.playerId)).toEqual([
            'p3',
            'p2',
            'p1'
        ])
        expect(settlement.createdBranches[0].branch.closed).toBe(false)
    })

    it('does nothing for a Game that is not resting in a span', () => {
        const spanGame = createSpanGame()
        const settlement = settle(spanGame, spanGame.state, [])
        expect(settlement.processedActions).toEqual([])
        expect(settlement.createdBranches).toEqual([])
        expect(settlement.updatedState).toEqual(spanGame.state)
    })
})

describe('Reversing the Main Line to the start of a Branch', () => {
    function played() {
        const spanGame = createSpanGame()
        const resting = beginSpan(spanGame)
        const inBranch = playLocally(spanGame, resting, [
            spanAction('w3', 'work', 'p3'),
            spanAction('w3b', 'work', 'p3')
        ])
        return { spanGame, resting, inBranch }
    }

    it('reverses back through the Branch’s Actions and its Branch Start', () => {
        const { spanGame, resting, inBranch } = played()
        const landed = reverseToBranchStart({
            engine: spanGame.engine,
            state: inBranch.state,
            history: inBranch.processedActions
        })
        expect(landed?.state).toEqual(resting)
        expect(summary(landed?.reversed ?? [])).toEqual(['openBranch:p3', 'work:p3', 'work:p3'])
    })

    it('reverses nothing when the Main Line is not inside a Branch', () => {
        const { spanGame, resting } = played()
        expect(
            reverseToBranchStart({ engine: spanGame.engine, state: resting, history: [] })
        ).toEqual({ state: resting, reversed: [] })
    })

    it('reports when the history given does not reach the start of the Branch', () => {
        const { spanGame, inBranch } = played()
        expect(
            reverseToBranchStart({
                engine: spanGame.engine,
                state: inBranch.state,
                history: inBranch.processedActions.slice(-1)
            })
        ).toBeUndefined()
    })
})

describe('A Fork taken inside a merged Branch', () => {
    it('starts where that Branch started and carries no hold', () => {
        const spanGame = createSpanGame()
        const begun = spanGame.engine.executeCanonicalAction({
            game: spanGame.game,
            state: spanGame.state,
            action: spanAction('begin', 'begin', 'p1')
        })
        const played = playLocally(spanGame, begun.updatedState, [
            spanAction('w3', 'work', 'p3'),
            spanAction('f3', 'finish', 'p3'),
            spanAction('w2', 'work', 'p2')
        ])
        const actions = [...begun.processedActions, ...played.processedActions]
        expect(summary(actions).at(-1)).toBe('work:p2')

        const fork = createGameFork({
            game: { ...spanGame.game, spanHold: { playerId: 'p2', reason: 'refused' } },
            state: played.state,
            actions,
            actionIndex: actions.length - 1,
            runtime: spanGame.runtime
        })
        expect(summary(fork.actions)).toEqual(['begin:p1', 'openBranch:p3', 'work:p3', 'finish:p3'])
        expect(fork.state.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
        expect(fork.state.parallelSpan?.branchPlayerId).toBeUndefined()
        expect(fork.game.lastActionPlayerId).toBe('p3')
        expect(fork.game.spanHold).toBeUndefined()
    })
})
