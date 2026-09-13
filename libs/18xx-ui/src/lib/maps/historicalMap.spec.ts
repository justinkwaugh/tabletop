import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { historicalMapSnapshot } from './historicalMap.js'

it('reconstructs the map after the selected action without changing the source or applying unrelated patches', () => {
    const original = {
        tileInventory: { tileSetId: 'tiles', placements: {
            B2: { pieceId: 'green', definitionId: 'green', rotation: 0 as const }
        }, retiredPieceIds: [] },
        stations: [],
        stationReservations: [],
        companies: []
    }
    const actions: GameAction[] = [
        { id: 'lay', gameId: 'test', type: 'LayTile', source: ActionSource.User,
            undoPatch: [{ op: 'remove', path: '/tileInventory/placements/B2' }] },
        { id: 'upgrade', gameId: 'test', type: 'LayTile', source: ActionSource.User,
            undoPatch: [
                { op: 'replace', path: '/tileInventory/placements/B2',
                    value: { pieceId: 'yellow', definitionId: 'yellow', rotation: 2 } },
                { op: 'replace', path: '/cash/0/amount', value: 900 },
                { op: 'add', path: '/stationReservations/0',
                    value: { companyId: 'A', locationId: 'B2', nodeId: 'city' } }
            ] },
        { id: 'later', gameId: 'test', type: 'Other', source: ActionSource.System,
            undoPatch: [{ op: 'replace', path: '/tileInventory',
                value: structuredClone(original.tileInventory) }] }
    ]
    const recorded = structuredClone(actions)
    const before = structuredClone(original)
    const result = historicalMapSnapshot(original, actions, 'lay')
    expect(result.tileInventory.placements.B2.definitionId).toBe('yellow')
    expect(result.tileInventory.placements.B2.rotation).toBe(2)
    expect(result.stationReservations).toHaveLength(1)
    expect(original).toEqual(before)
    expect(actions).toEqual(recorded)
    expect(historicalMapSnapshot(original, actions, 'upgrade').tileInventory).toEqual(original.tileInventory)
    expect(() => historicalMapSnapshot(original, actions, 'missing')).toThrow()
})
