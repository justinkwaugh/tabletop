import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from './gameAction.js'
import { RecordedHistory } from './recordedHistory.js'
import { createPrivateHandGame } from '../visibility/tests/privateHandGame.js'

it('matches engine reversal and detaches selected values and snapshots from records', () => {
    const { state, engine, game, firstPlay } = createPrivateHandGame()
    const result = engine.executeCanonicalAction({ state, game, action: firstPlay })
    const original = structuredClone(result)
    const history = new RecordedHistory(result.updatedState, result.processedActions)
    const states = history.select((value) => value)
    let after = result.updatedState
    for (const action of result.processedActions.toReversed()) {
        const before = engine.undoProcessedAction({ state: after, action })
        expect(history.after(action.id)).toEqual(after)
        expect(states.get(action.id)).toEqual({ before, after })
        after = before
    }
    const snapshot = history.after(result.processedActions[0].id)
    snapshot.activePlayerIds.length = 0
    expect(result).toEqual(original)
})

it('supports root replacement and cross-field move/copy without mutating inserted patch values', () => {
    const { state } = createPrivateHandGame()
    const before = {
        ...structuredClone(state),
        activePlayerIds: ['before'],
        actionCount: 1,
        actionChecksum: 11
    }
    const middle = {
        ...structuredClone(state),
        activePlayerIds: ['middle'],
        actionCount: 2,
        actionChecksum: 22
    }
    const after = {
        ...structuredClone(state),
        activePlayerIds: ['after'],
        actionCount: 3,
        actionChecksum: 33
    }
    const actions: GameAction[] = [
        { id: 'one', gameId: 'test', type: 'test', source: ActionSource.System, undoPatch: [] },
        {
            id: 'two',
            gameId: 'test',
            type: 'test',
            source: ActionSource.System,
            undoPatch: [
                { op: 'replace', path: '/activePlayerIds/0', value: 'before' },
                { op: 'replace', path: '/actionCount', value: 1 },
                { op: 'replace', path: '/actionChecksum', value: 11 }
            ]
        },
        {
            id: 'three',
            gameId: 'test',
            type: 'test',
            source: ActionSource.System,
            undoPatch: [
                { op: 'replace', path: '', value: middle },
                { op: 'copy', from: '/activePlayerIds', path: '/temporary' },
                { op: 'remove', path: '/activePlayerIds' },
                { op: 'move', from: '/temporary', path: '/activePlayerIds' }
            ]
        }
    ]
    const original = structuredClone({ after, actions })
    const history = new RecordedHistory(after, actions)
    expect(history.after('one')).toEqual(before)
    const values = history.select((value) => value.activePlayerIds)
    expect(values.get('two')).toEqual({ before: ['before'], after: ['middle'] })
    expect(values.get('three')).toEqual({ before: ['middle'], after: ['after'] })
    expect({ after, actions }).toEqual(original)
    expect(middle.activePlayerIds).toEqual(['middle'])
})

it('stops at unavailable history instead of fabricating a before-state', () => {
    const { state } = createPrivateHandGame()
    const actions: GameAction[] = ['earlier', 'boundary', 'later'].map((id) => ({
        id,
        gameId: 'test',
        type: 'test',
        source: ActionSource.System,
        ...(id === 'boundary' ? {} : { undoPatch: [] })
    }))
    const history = new RecordedHistory(state, actions)
    const selected = history.select((value) => value.activePlayerIds)
    expect([...selected.keys()]).toEqual(['later', 'boundary'])
    expect(selected.get('boundary')?.before).toBeUndefined()
    expect(history.after('boundary')).toBeDefined()
    expect(() => history.after('earlier')).toThrow('Action has no undo patch')
    expect(() => history.after('missing')).toThrow('Recorded action must belong')
})
