import { describe, expect, it } from 'vitest'
import { ActionType, SearchSource } from '@tabletop/oath'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    drawIdsClearedBy,
    readClearedDrawIds,
    saveClearedDrawIds,
    unseenVisionDraws,
    visionsClearedKey
} from './visionSeen.js'

function action(id: string, fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id, gameId: 'g1', source: ActionSource.User, ...fields }
}

const search = (id: string, playerId: string, stoppedOnVision?: boolean) =>
    action(id, { type: ActionType.Search, playerId, drawFrom: SearchSource.WorldDeck, metadata: { supplySpent: 2, cardsDrawn: 2, visionsDrawn: 1, stoppedOnVision } })

const ended = (id: string) => action(id, { type: ActionType.EndActPhase, playerId: 'p1' })

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
    const items = new Map<string, string>()
    return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) }
}

describe('the Vision draws a seat has not cleared (R-5.1.2, R-9.4)', () => {
    it('lists none before any Vision is drawn', () => {
        expect(unseenVisionDraws([ended('a1'), search('a2', 'p1', false)], [])).toEqual([])
    })

    it('lists each draw not yet cleared, oldest first, the drawer’s own included', () => {
        const actions = [search('a1', 'p1', true), ended('a2'), search('a3', 'p2', true), search('a4', 'p1', true)]
        expect(unseenVisionDraws(actions, [])).toEqual([
            { actionId: 'a1', drawerId: 'p1' },
            { actionId: 'a3', drawerId: 'p2' },
            { actionId: 'a4', drawerId: 'p1' }
        ])
        expect(unseenVisionDraws(actions, ['a1', 'a3'])).toEqual([{ actionId: 'a4', drawerId: 'p1' }])
        expect(unseenVisionDraws(actions, drawIdsClearedBy(actions, []))).toEqual([])
    })

    it('counts Oracle’s draw', () => {
        const oracle = action('a1', { type: ActionType.UseActionPower, playerId: 'p2', cardId: 'denizen.nomad.oracle', powerIndex: 0, metadata: { summary: '', visionDrawn: true } })
        expect(unseenVisionDraws([oracle], [])).toEqual([{ actionId: 'a1', drawerId: 'p2' }])
    })

    it('gives nothing for a Search recorded before the public flag', () => {
        expect(unseenVisionDraws([search('a1', 'p1')], [])).toEqual([])
    })

    it('remembers per game and per seat', () => {
        expect(visionsClearedKey('g1', 'p2')).toBe('oath:g1:p2:visionsCleared')
    })
})

describe('a cleared draw stays cleared when an undo removes the last one cleared', () => {
    const key = visionsClearedKey('g1', 'p2')
    const first = search('a1', 'p1', true)
    const second = search('a3', 'p2', true)
    const later = search('a5', 'p1', true)

    it('clears two draws; with the second undone nothing shows, and a new draw shows once', () => {
        const storage = memoryStorage()
        saveClearedDrawIds(storage, key, drawIdsClearedBy([first, ended('a2'), second], []))
        const undone = [first, ended('a2')]
        const cleared = readClearedDrawIds(storage.getItem(key) ?? undefined)
        expect(unseenVisionDraws(undone, cleared)).toEqual([])
        const redrawn = [...undone, later]
        expect(unseenVisionDraws(redrawn, cleared)).toEqual([{ actionId: 'a5', drawerId: 'p1' }])
        expect(unseenVisionDraws(redrawn, drawIdsClearedBy(redrawn, cleared))).toEqual([])
    })

    it('reads a stored value that is not a list as nothing cleared, and keeps only the ids in a list', () => {
        expect(readClearedDrawIds('a3')).toEqual([])
        expect(readClearedDrawIds('{"a1":true}')).toEqual([])
        expect(readClearedDrawIds('["a1",2]')).toEqual(['a1'])
    })

    it('takes a blocked or missing storage without throwing, and reads nothing stored as nothing cleared', () => {
        const blocked = { setItem: () => { throw new Error('QuotaExceededError') } }
        expect(() => saveClearedDrawIds(blocked, key, ['a1'])).not.toThrow()
        expect(() => saveClearedDrawIds(undefined, key, ['a1'])).not.toThrow()
        expect(readClearedDrawIds(undefined)).toEqual([])
    })
})
