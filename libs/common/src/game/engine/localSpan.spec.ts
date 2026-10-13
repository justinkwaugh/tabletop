import { describe, expect, it } from 'vitest'
import type { GameAction } from './gameAction.js'
import { executeInLocalGame } from './localSpan.js'
import { createSpanGame, spanAction, type SpanGameOptions } from './tests/spanGame.js'
import { summary } from './tests/spanPlay.js'

function localPlay(options: SpanGameOptions = {}) {
    const spanGame = createSpanGame(options)
    let state = spanGame.state
    return {
        spanGame,
        get state() {
            return state
        },
        take(action: GameAction) {
            const result = executeInLocalGame({ ...spanGame, state, action })
            state = result.updatedState
            return result
        }
    }
}

describe('Executing an Action in a Local Game', () => {
    it('opens the first Branch in Merge Order after the Action that begins the span', () => {
        const play = localPlay()
        const begun = play.take(spanAction('begin', 'begin', 'p1'))
        expect(summary(begun.processedActions)).toEqual(['begin:p1', 'openBranch:p3'])
        expect(begun.actionCascade.transitions).toHaveLength(2)
        expect(play.state.parallelSpan?.branchPlayerId).toBe('p3')
        expect(play.state.activePlayerIds).toEqual(['p3'])
    })

    it('asks for nothing after an Action that leaves a Branch open', () => {
        const play = localPlay()
        play.take(spanAction('begin', 'begin', 'p1'))
        const worked = play.take(spanAction('w3', 'work', 'p3'))
        expect(summary(worked.processedActions)).toEqual(['work:p3'])
    })

    it('opens the next Branch after the Action that closes one', () => {
        const play = localPlay()
        play.take(spanAction('begin', 'begin', 'p1'))
        const closed = play.take(spanAction('f3', 'finish', 'p3'))
        expect(summary(closed.processedActions)).toEqual([
            'finish:p3',
            'closeBranch:p3',
            'openBranch:p2'
        ])
        expect(play.state.activePlayerIds).toEqual(['p2'])
    })

    it('opens the first Branch of a span that Span Completion leads into', () => {
        const play = localPlay({ spans: 2 })
        play.take(spanAction('begin', 'begin', 'p1'))
        play.take(spanAction('f3', 'finish', 'p3'))
        play.take(spanAction('f2', 'finish', 'p2'))
        const last = play.take(spanAction('f1', 'finish', 'p1'))
        expect(summary(last.processedActions)).toEqual([
            'finish:p1',
            'closeBranch:p1',
            'complete:',
            'nextSpan:',
            'openBranch:p3'
        ])
        expect(play.state.parallelSpan?.mergedPlayerIds).toEqual([])
    })

    it('is reversed whole by undoing what it returned', () => {
        const play = localPlay()
        play.take(spanAction('begin', 'begin', 'p1'))
        const before = play.state
        const closed = play.take(spanAction('f3', 'finish', 'p3'))
        let state = play.state
        for (const action of closed.processedActions.toReversed()) {
            state = play.spanGame.engine.undoProcessedAction({ action, state })
        }
        expect(state).toEqual(before)
    })
})
