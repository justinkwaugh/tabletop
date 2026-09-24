import { describe, expect, it } from 'vitest'
import { createNoteGame, note, noteGameRuntime, step } from './tests/noteGame.js'
import { replaceSupersededAction } from './supersede.js'
import type { GameAction } from './gameAction.js'

function history(...actions: GameAction[]) {
    const { engine, game, state } = createNoteGame()
    let current = state
    const processed: GameAction[] = []
    for (const action of actions) {
        const result = engine.executeCanonicalAction({ game, state: current, action })
        processed.push(...result.processedActions)
        current = result.updatedState
    }
    return { engine, game, state: current, processed }
}

describe('replaceSupersededAction', () => {
    it('replaces a declaration that later independent Actions did not depend on', () => {
        const { engine, game, state, processed } = history(
            step('s1', 'note-game', 'p1'),
            note('n1', 'note-game', 'p3', 'first'),
            step('s2', 'note-game', 'p2')
        )
        const outcome = replaceSupersededAction({
            engine,
            apiActions: noteGameRuntime.apiActions,
            game,
            state,
            window: processed.slice(1),
            replacement: { ...note('n2', 'note-game', 'p3', 'second'), supersedesActionId: 'n1' }
        })
        expect(outcome.kind).toBe('replace')
        if (outcome.kind !== 'replace') return
        expect(outcome.undone.map((action) => action.id)).toEqual(['n1', 's2'])
        expect(outcome.redone.map((action) => action.id)).toEqual(['s2'])
        expect(outcome.state.actionCount).toBe(2)
        expect(outcome.state.notes).toEqual({})
    })

    it('refuses a replacement naming another player’s or another type’s Action', () => {
        const { engine, game, state, processed } = history(
            step('s1', 'note-game', 'p1'),
            note('n1', 'note-game', 'p3', 'first')
        )
        const replacement = { ...note('n2', 'note-game', 'p2', 'second'), supersedesActionId: 'n1' }
        const outcome = replaceSupersededAction({
            engine,
            apiActions: noteGameRuntime.apiActions,
            game,
            state,
            window: processed.slice(1),
            replacement
        })
        expect(outcome.kind).toBe('invalid')
        const wrongType = replaceSupersededAction({
            engine,
            apiActions: noteGameRuntime.apiActions,
            game,
            state,
            window: processed.slice(0),
            replacement: { ...step('s2', 'note-game', 'p1'), supersedesActionId: 's1' }
        })
        expect(wrongType.kind).toBe('invalid')
    })
})
