import { Firestore } from '@google-cloud/firestore'
import * as Value from 'typebox/value'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { RedisCacheService } from '../../cache/cacheService.js'
import { StoredGame } from '../model/storedGame.js'
import { FirestoreGameStore } from './gameStore.js'

describe('FirestoreGameStore action ranges', () => {
    const firestore = new Firestore({ projectId: 'tabletop-test' })
    const store = new FirestoreGameStore(Object.create(RedisCacheService.prototype), firestore)

    afterEach(() => {
        vi.restoreAllMocks()
    })

    test('returns no actions without reading Firestore when the range is empty', async () => {
        const game = Value.Create(StoredGame)
        game.id = 'game-id'
        game.actionChunkSize = 200
        const getAll = vi.spyOn(firestore, 'getAll')

        const actions = await store.findActionRangeForGame({
            game,
            startIndex: 14,
            endIndex: 13
        })

        expect(actions).toEqual([])
        expect(getAll).not.toHaveBeenCalled()
    })
})
