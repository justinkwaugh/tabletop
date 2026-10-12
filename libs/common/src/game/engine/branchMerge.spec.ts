import { describe, expect, it } from 'vitest'
import type { GameAction } from './gameAction.js'
import { branchUndoWindow, branchView } from './branch.js'
import { isBranchClose } from './parallelSpan.js'
import { createSpanGame, spanAction, type SpanGameState } from './tests/spanGame.js'
import {
    beginSpan,
    closeOnMainLine,
    mergePrivatePlay,
    playLocally,
    playPrivately,
    playerOf,
    summary,
    type PrivatePlay,
    type SpanGame
} from './tests/spanPlay.js'

const thirdPlayerActions = [
    spanAction('r3', 'roll', 'p3'),
    spanAction('item-3', 'stash', 'p3', { label: 'three' }),
    spanAction('q3', 'queue', 'p3', { amount: 3 }),
    spanAction('f3', 'finish', 'p3')
]
const secondPlayerActions = [
    spanAction('w2', 'work', 'p2'),
    spanAction('r2', 'roll', 'p2'),
    spanAction('q2', 'queue', 'p2', { amount: 2 }),
    spanAction('f2', 'finish', 'p2')
]
const firstPlayerActions = [spanAction('w1', 'work', 'p1'), spanAction('f1', 'finish', 'p1')]

function undo(
    spanGame: SpanGame,
    state: SpanGameState,
    play: PrivatePlay,
    actionId: string,
    asAdministrator = false
) {
    return spanGame.engine.undoBranchAction({
        state,
        branch: play.branch,
        actions: play.actions,
        actionId,
        asAdministrator
    })
}

describe('Branch Undo', () => {
    it('reverses a User Action and everything after it, and nothing on the Main Line', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const before = structuredClone(state)
        const play = playPrivately(spanGame, state, 'p2', [
            spanAction('w1', 'work', 'p2'),
            spanAction('item-1', 'stash', 'p2', { label: 'mine' }),
            spanAction('w2', 'work', 'p2')
        ])
        const undone = undo(spanGame, state, play, 'item-1')
        expect(summary(undone.undoneActions)).toEqual(['stash:p2', 'work:p2'])
        expect(playerOf(undone.view, 'p2').work).toBe(1)
        expect(undone.view.items).toEqual({})
        expect(undone.branch).toEqual(
            playPrivately(spanGame, state, 'p2', [spanAction('w1', 'work', 'p2')]).branch
        )
        expect(state).toEqual(before)
    })

    it('stops a Player at their own Information-Revealing Action', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', [
            spanAction('w1', 'work', 'p2'),
            spanAction('r1', 'roll', 'p2'),
            spanAction('w2', 'work', 'p2')
        ])
        expect(() => undo(spanGame, state, play, 'w1')).toThrow(
            'Undo refused in the Branch of p2: it would undo an Action that revealed information'
        )
        expect(playerOf(undo(spanGame, state, play, 'w2').view, 'p2').work).toBe(1)
    })

    it('lets an administrator undo across it, after which the same roll comes again', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', [spanAction('r1', 'roll', 'p2')])
        const undone = undo(spanGame, state, play, 'r1', true)
        expect(playerOf(undone.view, 'p2').rolls).toEqual([])
        const again = spanGame.engine.executeBranchAction({
            game: spanGame.game,
            state,
            branch: undone.branch,
            action: spanAction('r2', 'roll', 'p2')
        })
        expect(playerOf(again.view, 'p2').rolls).toEqual(playerOf(play.view, 'p2').rolls)
    })

    it('never undoes Branch Start or the System Actions it generated, even for an administrator', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', [spanAction('w1', 'work', 'p2')])
        expect(() => undo(spanGame, state, play, play.actions[0].id, true)).toThrow(
            'Undo refused in the Branch of p2: only a User Action can be undone'
        )
    })

    it('reopens a Closed Branch when the Action that closed it is undone', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', [
            spanAction('w2', 'work', 'p2'),
            spanAction('f2', 'finish', 'p2')
        ])
        expect(play.branch.closed).toBe(true)
        const closedOnMainLine = closeOnMainLine(spanGame, state, 'p2')
        const undone = undo(spanGame, closedOnMainLine, play, 'f2')
        expect(summary(undone.undoneActions)).toEqual(['finish:p2'])
        expect(undone.branch.closed).toBe(false)
        expect(playerOf(undone.view, 'p2').work).toBe(1)
        expect(undone.view.parallelSpan?.branchPlayerId).toBe('p2')
        expect(undone.view.activePlayerIds).toEqual(['p2'])
    })

    it('leaves the reopened Player alone in their Branch whoever else has closed since', () => {
        const spanGame = createSpanGame({ merge: 'barrier' })
        const state = beginSpan(spanGame)
        const third = playPrivately(spanGame, state, 'p3', [spanAction('f3', 'finish', 'p3')])
        const second = playPrivately(spanGame, closeOnMainLine(spanGame, state, 'p3'), 'p2', [
            spanAction('f2', 'finish', 'p2')
        ])
        const bothClosed = closeOnMainLine(spanGame, closeOnMainLine(spanGame, state, 'p3'), 'p2')
        const reopened = undo(spanGame, bothClosed, third, 'f3')
        expect(reopened.view.activePlayerIds).toEqual(['p3'])
        expect(branchView(bothClosed, second.branch).activePlayerIds).toEqual(['p1'])
        expect(undo(spanGame, bothClosed, second, 'f2').view.activePlayerIds).toEqual(['p2'])
    })

    it('refuses recorded Actions that do not end where the Branch does', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', [
            spanAction('w1', 'work', 'p2'),
            spanAction('w2', 'work', 'p2')
        ])
        expect(() =>
            undo(spanGame, state, { ...play, actions: play.actions.slice(0, -1) }, 'w1')
        ).toThrow('The recorded Actions do not end where the Branch does')
    })

    describe('what a Player may undo', () => {
        const spanGame = createSpanGame()
        const play = playPrivately(spanGame, beginSpan(spanGame), 'p2', [
            spanAction('w1', 'work', 'p2'),
            spanAction('r1', 'roll', 'p2'),
            spanAction('w2', 'work', 'p2'),
            spanAction('w3', 'work', 'p2')
        ])

        it('is an Action and everything after it', () => {
            expect(branchUndoWindow(play.actions, 'w2')).toEqual({
                kind: 'undo',
                actions: play.actions.slice(-2)
            })
        })

        it('stops at an Information-Revealing Action', () => {
            const refusal = {
                kind: 'refused',
                reason: 'it would undo an Action that revealed information'
            }
            expect(branchUndoWindow(play.actions, 'r1')).toEqual(refusal)
            expect(branchUndoWindow(play.actions, 'w1')).toEqual(refusal)
        })

        it('reaches past an Information-Revealing Action for an administrator', () => {
            expect(branchUndoWindow(play.actions, 'w1', { asAdministrator: true })).toEqual({
                kind: 'undo',
                actions: play.actions.slice(1)
            })
        })

        it('is never Branch Start', () => {
            expect(branchUndoWindow(play.actions, play.actions[0].id)).toEqual({
                kind: 'refused',
                reason: 'only a User Action can be undone'
            })
        })

        it('is never an Action outside the Branch', () => {
            expect(branchUndoWindow(play.actions, 'missing')).toEqual({
                kind: 'refused',
                reason: 'the Action is not in this Branch'
            })
        })
    })
})

describe('Merge', () => {
    it('places a Closed Branch on the Main Line as a contiguous run with final positions', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p3', thirdPlayerActions)
        const merged = mergePrivatePlay(spanGame, state, play)
        expect(summary(merged.processedActions)).toEqual(summary(play.actions))
        expect(merged.processedActions.map((action) => action.id)).toEqual(
            play.actions.map((action) => action.id)
        )
        expect(merged.processedActions.map((action) => action.index)).toEqual([2, 3, 4, 5, 6])
        expect(merged.updatedState.actionCount).toBe(7)
        expect(merged.updatedState.parallelSpan?.closedPlayerIds).toEqual(['p3'])
        expect(merged.updatedState.parallelSpan?.mergedPlayerIds).toEqual(['p3'])
        expect(merged.updatedState.machineState).toBe('branching')
        expect(merged.updatedState.activePlayerIds).toEqual(['p2', 'p1'])
        expect(playerOf(merged.updatedState, 'p3')).toEqual(playerOf(play.view, 'p3'))
    })

    it('gives merged Actions undo patches that reverse on the Main Line', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const merged = mergePrivatePlay(
            spanGame,
            state,
            playPrivately(spanGame, state, 'p3', thirdPlayerActions)
        )
        let reversed = merged.updatedState
        for (const action of merged.processedActions.toReversed()) {
            reversed = spanGame.engine.undoProcessedAction({ action, state: reversed })
        }
        expect(reversed).toEqual(closeOnMainLine(spanGame, state, 'p3'))
    })

    it('merges a Player who closed first after the Player ahead of them', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const second = playPrivately(spanGame, state, 'p2', secondPlayerActions)
        const third = playPrivately(spanGame, state, 'p3', thirdPlayerActions)
        const secondClosed = closeOnMainLine(spanGame, state, 'p2')
        expect(spanGame.engine.branchesReadyToMerge({ state: secondClosed })).toEqual([])
        const afterThird = mergePrivatePlay(spanGame, secondClosed, third).updatedState
        expect(afterThird.parallelSpan?.closedPlayerIds).toEqual(['p2', 'p3'])
        const afterSecond = mergePrivatePlay(spanGame, afterThird, second)
        expect(afterSecond.updatedState.parallelSpan?.mergedPlayerIds).toEqual(['p3', 'p2'])
        expect(afterSecond.processedActions.map((action) => action.index)).toEqual([
            8, 9, 10, 11, 12
        ])
        expect(playerOf(afterSecond.updatedState, 'p2').work).toBe(1)
        expect(playerOf(afterSecond.updatedState, 'p3').queued).toBe(3)
    })

    it.each([
        { closes: ['p3', 'p2', 'p1'], name: 'each Branch merging as it closes' },
        { closes: ['p2', 'p1', 'p3'], name: 'Branches closing in another order than they merge' }
    ])(
        'reaches what a Local Game reaches playing the same Actions in turn, with $name',
        ({ closes }) => {
            const spanGame = createSpanGame()
            const branchPoint = beginSpan(spanGame)
            const plays: Record<string, PrivatePlay> = {
                p1: playPrivately(spanGame, branchPoint, 'p1', firstPlayerActions),
                p2: playPrivately(spanGame, branchPoint, 'p2', secondPlayerActions),
                p3: playPrivately(spanGame, branchPoint, 'p3', thirdPlayerActions)
            }
            const history: GameAction[] = []
            let mainLine = branchPoint
            const record = (step: {
                processedActions: GameAction[]
                updatedState: SpanGameState
            }) => {
                history.push(...step.processedActions)
                mainLine = step.updatedState
            }
            for (const playerId of closes) {
                record(spanGame.engine.closeBranch({ state: mainLine, playerId }))
                for (const ready of spanGame.engine.branchesReadyToMerge({ state: mainLine })) {
                    record(mergePrivatePlay(spanGame, mainLine, plays[ready]))
                }
            }
            record(spanGame.engine.completeSpan({ game: spanGame.game, state: mainLine }))

            const played = playLocally(spanGame, branchPoint, [
                ...thirdPlayerActions,
                ...secondPlayerActions,
                ...firstPlayerActions
            ])

            const identified = (actions: readonly GameAction[]) =>
                actions.map((action) => `${action.type}:${action.id}`)
            const apartFromCloses = (actions: readonly GameAction[]) =>
                identified(actions.filter((action) => !isBranchClose(action)))
            const closesOf = (actions: readonly GameAction[]) =>
                identified(actions.filter(isBranchClose)).toSorted()
            expect(apartFromCloses(history)).toEqual(apartFromCloses(played.processedActions))
            expect(closesOf(history)).toEqual(closesOf(played.processedActions))
            expect(closesOf(history)).toHaveLength(3)
            expect(history.map((action) => action.index)).toEqual(
                played.processedActions.map((action) => action.index)
            )
            expect({ ...mainLine, actionChecksum: 0 }).toEqual({
                ...played.state,
                actionChecksum: 0
            })
            expect(mainLine.pot).toBe(5)
        }
    )

    it('refuses a Branch that is still open', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p3', [spanAction('w3', 'work', 'p3')])
        expect(() => mergePrivatePlay(spanGame, state, play)).toThrow(
            'The Branch of p3 is still open'
        )
    })

    it('refuses a Branch out of Merge Order', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p2', secondPlayerActions)
        expect(() => mergePrivatePlay(spanGame, state, play)).toThrow(
            'The Branch of p2 is not next in Merge Order'
        )
    })

    it('refuses a Branch whose result depended on a Branch ahead of it', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const dependent = playPrivately(spanGame, state, 'p2', [
            spanAction('k2', 'peek', 'p2', { otherPlayerId: 'p3' }),
            spanAction('f2', 'finish', 'p2')
        ])
        const ahead = playPrivately(spanGame, state, 'p3', [
            spanAction('w3', 'work', 'p3'),
            spanAction('f3', 'finish', 'p3')
        ])
        const afterAhead = mergePrivatePlay(spanGame, state, ahead).updatedState
        expect(() => mergePrivatePlay(spanGame, afterAhead, dependent)).toThrow(
            'The Branch of p2 cannot be merged: it reached a different Game State on the Main Line'
        )
    })

    it('accepts a Branch that read only what a Player had before the span began', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const reader = playPrivately(spanGame, state, 'p3', [
            spanAction('k3', 'peek', 'p3', { otherPlayerId: 'p2' }),
            spanAction('f3', 'finish', 'p3')
        ])
        expect(
            mergePrivatePlay(spanGame, state, reader).updatedState.parallelSpan?.mergedPlayerIds
        ).toEqual(['p3'])
    })

    it('refuses a Branch whose System Action cascade runs differently on the Main Line', () => {
        const spanGame = createSpanGame({ idle: ['p3'] })
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p3', [])
        expect(summary(play.actions)).toEqual(['openBranch:p3', 'idleSkip:p3'])
        expect(() =>
            mergePrivatePlay(spanGame, state, { ...play, actions: play.actions.slice(0, 1) })
        ).toThrow('The Branch of p3 cannot be merged: openBranch ran differently on the Main Line')
    })

    it('refuses a record that does not begin with the Branch’s own Branch Start', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p3', thirdPlayerActions)
        expect(() =>
            mergePrivatePlay(spanGame, state, { ...play, actions: play.actions.slice(1) })
        ).toThrow('its record does not begin with its Branch Start')
    })

    it('refuses a record that stops short of the Branch', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p3', thirdPlayerActions)
        expect(() =>
            mergePrivatePlay(spanGame, state, { ...play, actions: play.actions.slice(0, -1) })
        ).toThrow('it reached a different Game State on the Main Line')
    })

    it('matches the Branch View it was given', () => {
        const spanGame = createSpanGame()
        const state = beginSpan(spanGame)
        const play = playPrivately(spanGame, state, 'p3', thirdPlayerActions)
        const merged = mergePrivatePlay(spanGame, state, play).updatedState
        const view = branchView(closeOnMainLine(spanGame, state, 'p3'), play.branch)
        expect(merged.items).toEqual(view.items)
        expect(merged.startingPositionRandom).toEqual(view.startingPositionRandom)
        expect(merged.parallelSpan).toEqual(view.parallelSpan)
    })
})

describe('Branches ready to merge', () => {
    function ready(merge: 'barrier' | 'ordered', closedPlayerIds: readonly string[]) {
        const spanGame = createSpanGame({ merge })
        return spanGame.engine.branchesReadyToMerge({
            state: closedPlayerIds.reduce(
                (state, playerId) => closeOnMainLine(spanGame, state, playerId),
                beginSpan(spanGame)
            )
        })
    }

    it('under an Ordered Merge are the Closed Branches with nobody open ahead of them', () => {
        expect(ready('ordered', ['p2'])).toEqual([])
        expect(ready('ordered', ['p3'])).toEqual(['p3'])
        expect(ready('ordered', ['p3', 'p1'])).toEqual(['p3'])
        expect(ready('ordered', ['p2', 'p3'])).toEqual(['p3', 'p2'])
    })

    it('under a Barrier Merge are none until every Branch is closed, then all in Merge Order', () => {
        expect(ready('barrier', ['p3', 'p2'])).toEqual([])
        expect(ready('barrier', ['p1', 'p2', 'p3'])).toEqual(['p3', 'p2', 'p1'])
    })
})
