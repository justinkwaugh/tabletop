import { describe, expect, it } from 'vitest'
import { CommandKind } from '@tabletop/napoleons-triumph'
import { inGameOrder, ordersInGameOrder } from './gameOrder.js'

const UNITS = [{ id: 'A01' }, { id: 'A02' }, { id: 'A03' }, { id: 'A04' }]

describe('units named in an action', () => {
    it('are sent as the game holds them, whatever order they were tapped in', () => {
        expect(inGameOrder(UNITS, ['A04', 'A01', 'A03'])).toEqual(['A01', 'A03', 'A04'])
    })

    it('are put in that order within each order of an attack, which keeps the rest of the order', () => {
        const orders = [
            { kind: CommandKind.Corps, commanderId: 'langeron', unitIds: ['A03', 'A02'] },
            { kind: CommandKind.Unit, unitIds: ['A04'] }
        ]
        expect(ordersInGameOrder(UNITS, orders)).toEqual([
            { kind: CommandKind.Corps, commanderId: 'langeron', unitIds: ['A02', 'A03'] },
            { kind: CommandKind.Unit, unitIds: ['A04'] }
        ])
    })
})
