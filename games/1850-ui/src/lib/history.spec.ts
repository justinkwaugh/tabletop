import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { PlaceEdgeToken } from '@tabletop/1850'
import { mapPlacement1850 } from './history.js'

const placed = (companyId: string, locationId: string): PlaceEdgeToken => ({
    id: 'action',
    gameId: 'game',
    source: ActionSource.User,
    playerId: 'p1',
    type: 'PlaceEdgeToken',
    companyId,
    metadata: {
        locationId,
        payment: { from: { kind: 'company', companyId }, to: { kind: 'bank' }, amount: 50 }
    }
})

describe('an edge token in history', () => {
    it('outlines the whole of a joined area, wherever the token stands in it', () => {
        expect(mapPlacement1850(placed('NP', 'A2'))?.locationIds).toEqual(['A2', 'B1'])
    })

    it('outlines the one hex of any other area', () => {
        expect(mapPlacement1850(placed('UP', 'F1'))?.locationIds).toEqual(['F1'])
    })
})
