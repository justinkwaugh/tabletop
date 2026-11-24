import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    DemandChange,
    LocomotiveId,
    SaleOutcome,
    type AdjustMarket,
    type Develop,
    type PayTaxes,
    type Ship
} from '@tabletop/locomotive-werks'
import { describeAction, describeDetails } from './describeAction.js'

const base = { id: 'a', gameId: 'g', source: ActionSource.User }

function text(description: ReturnType<typeof describeAction>): string {
    return description
        .map((segment) =>
            typeof segment === 'string'
                ? segment
                : 'playerId' in segment
                  ? `<${segment.playerId}>`
                  : `[${segment.locomotiveId}]`
        )
        .join(' ')
}

describe('describing actions', () => {
    it('tells a development and the dice and cards it moved', () => {
        const develop: Develop = {
            ...base,
            type: ActionType.Develop,
            playerId: 'p1',
            locomotiveId: LocomotiveId.Passenger3,
            metadata: {
                cost: 32,
                initialOrder: 4,
                nextLocomotiveId: LocomotiveId.Special2,
                nextRoll: 6,
                retiredLocomotiveId: LocomotiveId.Passenger1,
                retiredCards: 2
            }
        }
        expect(text(describeAction(develop))).toBe('developed [passenger-3] for $32')
        expect(describeDetails(develop).map(text)).toEqual([
            'New Initial Orders: a 6 for [special-2]',
            '2 unbought [passenger-1] cards leave play'
        ])
    })

    it('tells each shipment and the die it filled or lowered', () => {
        const ship: Ship = {
            ...base,
            type: ActionType.Ship,
            playerId: 'p1',
            locomotiveIds: [LocomotiveId.Passenger1, LocomotiveId.Fast1],
            metadata: {
                sellingRound: 1,
                income: 5,
                shipments: [
                    {
                        locomotiveId: LocomotiveId.Passenger1,
                        units: 3,
                        income: 3,
                        face: 3,
                        outcome: SaleOutcome.Matched
                    },
                    {
                        locomotiveId: LocomotiveId.Fast1,
                        units: 1,
                        income: 2,
                        face: 4,
                        outcome: SaleOutcome.Reduced
                    }
                ]
            }
        }
        expect(text(describeAction(ship))).toBe('shipped for $5')
        expect(describeDetails(ship).map(text)).toEqual([
            '3 units of [passenger-1] for $3, filling the 3',
            '1 unit of [fast-1] for $2, the 4 drops to 3'
        ])
    })

    it('tells a held-back selling turn', () => {
        const hold: Ship = {
            ...base,
            type: ActionType.Ship,
            playerId: 'p1',
            locomotiveIds: []
        }
        expect(text(describeAction(hold))).toBe('held back their locomotives')
    })

    it('lists taxes and the new Player Order', () => {
        const taxes: PayTaxes = {
            ...base,
            source: ActionSource.System,
            type: ActionType.PayTaxes,
            metadata: {
                gameOver: false,
                payments: [{ playerId: 'p1', tax: 4, cash: 43 }],
                playerOrder: ['p2', 'p1']
            }
        }
        expect(describeDetails(taxes).map(text)).toEqual([
            '<p1> pays $4, keeping $43',
            'Player Order: 1. <p2> · 2. <p1>'
        ])
    })

    it('lists each Market Demands step with its rolls', () => {
        const market: AdjustMarket = {
            ...base,
            source: ActionSource.System,
            type: ActionType.AdjustMarket,
            metadata: {
                steps: [
                    {
                        locomotiveId: LocomotiveId.Passenger1,
                        change: DemandChange.Obsolete,
                        added: 0,
                        returned: 3,
                        rolls: []
                    },
                    {
                        locomotiveId: LocomotiveId.Passenger2,
                        change: DemandChange.Grown,
                        added: 1,
                        returned: 0,
                        rolls: [2, 5]
                    }
                ]
            }
        }
        expect(describeDetails(market).map(text)).toEqual([
            '[passenger-1] is obsolete: 3 dice return',
            '[passenger-2] gains a die, rolled 2, 5'
        ])
    })
})
