import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/reef-encounter'
import { historyEntries } from './historyEntries.js'

const action = (type: ActionType, playerId?: string): GameAction => ({
    id: `${type}-${playerId ?? 'system'}-${Math.random()}`,
    gameId: 'game',
    type,
    playerId,
    source: playerId ? ActionSource.User : ActionSource.System
})

describe('history entries', () => {
    it('groups a player turn with the refill it causes', () => {
        const entries = historyEntries([
            action(ActionType.PlayLarvaCube, 'a'),
            action(ActionType.PlacePolyp, 'a'),
            action(ActionType.TakeOpenSeaSpace, 'a'),
            action(ActionType.RefillOpenSea),
            action(ActionType.PlayLarvaCube, 'b')
        ])
        expect(entries.map((entry) => [entry.playerId, entry.actions.length])).toEqual([
            ['a', 4],
            ['b', 1]
        ])
        expect(entries[0].lastActionIndex).toBe(3)
        expect(entries[1].firstActionIndex).toBe(4)
    })

    it('gives each setup choice by a different player its own entry', () => {
        const entries = historyEntries([
            action(ActionType.FeedParrotfish, 'a'),
            action(ActionType.FeedParrotfish, 'b'),
            action(ActionType.ChooseLarvaCubes, 'a')
        ])
        expect(entries.map((entry) => entry.playerId)).toEqual(['a', 'b', 'a'])
    })

    it('sets the end of the game apart from the last turn', () => {
        const entries = historyEntries([
            action(ActionType.EatCoral, 'a'),
            action(ActionType.EndGame)
        ])
        expect(entries.map((entry) => entry.playerId)).toEqual(['a', undefined])
    })
})
