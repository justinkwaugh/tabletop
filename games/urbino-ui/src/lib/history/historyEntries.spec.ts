import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, BuildingType } from '@tabletop/urbino'
import { entryContaining, historyEntries } from './historyEntries.js'

let nextId = 0
function action(type: ActionType, playerId: string, fields: Record<string, unknown> = {}): GameAction {
    nextId += 1
    return { id: `a${nextId}`, gameId: 'g', source: ActionSource.User, type, playerId, ...fields }
}

describe('historyEntries', () => {
    it('numbers architects by placement order and records the first player choice', () => {
        const entries = historyEntries([
            action(ActionType.PlaceArchitect, 'p1', { position: 10 }),
            action(ActionType.PlaceArchitect, 'p2', { position: 40 }),
            action(ActionType.ChooseFirstPlayer, 'p1', { startingPlayerId: 'p2' })
        ])
        expect(entries.map((entry) => entry.kind)).toEqual(['architect', 'architect', 'firstPlayer'])
        expect(entries[1]).toMatchObject({ architectNumber: 2, position: 40, playerId: 'p2' })
        expect(entries[2]).toMatchObject({ startingPlayerId: 'p2' })
    })

    it('groups an architect move with the building that follows it', () => {
        const entries = historyEntries([
            action(ActionType.RepositionArchitect, 'p1', { architectIndex: 1, position: 5 }),
            action(ActionType.PlaceBuilding, 'p1', { position: 6, buildingType: BuildingType.Tower }),
            action(ActionType.PlaceBuilding, 'p2', { position: 7, buildingType: BuildingType.House })
        ])
        expect(entries).toHaveLength(2)
        expect(entries[0]).toMatchObject({
            kind: 'turn',
            firstIndex: 0,
            lastIndex: 1,
            move: { architectNumber: 2, position: 5 },
            build: { buildingType: BuildingType.Tower, position: 6 },
            complete: true
        })
        expect(entries[1]).toMatchObject({ playerId: 'p2', firstIndex: 2, lastIndex: 2 })
    })

    it('leaves a turn open while its player has only moved an architect', () => {
        const entries = historyEntries([
            action(ActionType.RepositionArchitect, 'p1', { architectIndex: 0, position: 3 })
        ])
        expect(entries[0]).toMatchObject({ kind: 'turn', complete: false, move: { architectNumber: 1 } })
    })

    it('closes a turn on a pass or a concession', () => {
        const entries = historyEntries([
            action(ActionType.Pass, 'p1'),
            action(ActionType.Concede, 'p2')
        ])
        expect(entries).toMatchObject([
            { passed: true, complete: true },
            { conceded: true, complete: true }
        ])
    })

    it('finds the entry holding an action', () => {
        const entries = historyEntries([
            action(ActionType.RepositionArchitect, 'p1', { architectIndex: 0, position: 3 }),
            action(ActionType.PlaceBuilding, 'p1', { position: 4, buildingType: BuildingType.House })
        ])
        expect(entryContaining(entries, 0)).toBe(entries[0])
        expect(entryContaining(entries, 1)).toBe(entries[0])
        expect(entryContaining(entries, 2)).toBeUndefined()
    })
})
