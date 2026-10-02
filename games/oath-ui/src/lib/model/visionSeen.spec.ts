import { describe, expect, it } from 'vitest'
import { ActionType, SearchSource } from '@tabletop/oath'
import { ActionSource, type GameAction } from '@tabletop/common'
import { unseenVisionDraws, visionsClearedKey } from './visionSeen.js'

function action(id: string, fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id, gameId: 'g1', source: ActionSource.User, ...fields }
}

const search = (id: string, playerId: string, stoppedOnVision?: boolean) =>
    action(id, { type: ActionType.Search, playerId, drawFrom: SearchSource.WorldDeck, metadata: { supplySpent: 2, cardsDrawn: 2, visionsDrawn: 1, stoppedOnVision } })

const ended = (id: string) => action(id, { type: ActionType.EndActPhase, playerId: 'p1' })

describe('the Vision draws a seat has not cleared (R-5.1.2, R-9.4)', () => {
    it('lists none before any Vision is drawn', () => {
        expect(unseenVisionDraws([ended('a1'), search('a2', 'p1', false)], undefined)).toEqual([])
    })

    it('lists each draw after the one last cleared, oldest first, the drawer’s own included', () => {
        const actions = [search('a1', 'p1', true), ended('a2'), search('a3', 'p2', true), search('a4', 'p1', true)]
        expect(unseenVisionDraws(actions, undefined)).toEqual([
            { actionId: 'a1', drawerId: 'p1' },
            { actionId: 'a3', drawerId: 'p2' },
            { actionId: 'a4', drawerId: 'p1' }
        ])
        expect(unseenVisionDraws(actions, 'a3')).toEqual([{ actionId: 'a4', drawerId: 'p1' }])
        expect(unseenVisionDraws(actions, 'a4')).toEqual([])
    })

    it('counts Oracle’s draw', () => {
        const oracle = action('a1', { type: ActionType.UseActionPower, playerId: 'p2', cardId: 'denizen.nomad.oracle', powerIndex: 0, metadata: { summary: '', visionDrawn: true } })
        expect(unseenVisionDraws([oracle], undefined)).toEqual([{ actionId: 'a1', drawerId: 'p2' }])
    })

    it('gives nothing for a Search recorded before the public flag', () => {
        expect(unseenVisionDraws([search('a1', 'p1')], undefined)).toEqual([])
    })

    it('remembers per game and per seat', () => {
        expect(visionsClearedKey('g1', 'p2')).toBe('oath:g1:p2:visionsCleared')
    })
})
