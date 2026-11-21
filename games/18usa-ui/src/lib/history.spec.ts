import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { moneyFormat } from '@tabletop/18xx-ui'
import { eighteenUSAHistoryDescription } from './history.js'

const action = (type: string, fields: object): GameAction => ({
    id: type,
    gameId: 'history',
    source: ActionSource.User,
    playerId: 'alex',
    type,
    ...fields
})

const describeAction = (entry: GameAction) =>
    eighteenUSAHistoryDescription(
        entry,
        {
            companyName: (id) => ({ P13: 'Pennsy Boneyard', P30: 'Double Heading' })[id] ?? id,
            playerName: (id) => id,
            poolName: () => 'Market',
            bankName: 'Bank'
        },
        moneyFormat('$'),
        () => ({ text: 'shared' })
    )

const payment = (amount: number) => ({
    from: { kind: 'company', companyId: 'UP' },
    to: { kind: 'bank' },
    amount
})

describe('18USA history', () => {
    it('names the Pullman bought and what it cost', () => {
        const row = describeAction(
            action('BuyPullman', {
                companyId: 'UP',
                metadata: { trainId: 'p', payment: payment(200) }
            })
        )
        expect(row).toMatchObject({ text: 'Bought a Pullman for UP', value: '$200' })
    })

    it('says where ore was upgraded', () => {
        expect(
            describeAction(action('UpgradeOre', { companyId: 'UP', locationId: 'C7' }))?.text
        ).toBe('Upgraded the ore at C7 for UP')
    })

    it('names the private whose power a train was given', () => {
        expect(
            describeAction(
                action('AssignTrainPower', {
                    companyId: 'UP',
                    trainId: 't',
                    power: 'double-heading'
                })
            )?.text
        ).toBe('Gave Double Heading to a UP train for its run')
    })

    it('tells a saved train from trains left to rust', () => {
        expect(describeAction(action('SaveTrain', { companyId: 'UP', trainId: 't' }))?.text).toBe(
            'Saved a UP train from rusting'
        )
        expect(describeAction(action('SaveTrain', { companyId: 'UP' }))?.text).toBe(
            'Let UP’s trains rust'
        )
    })

    it('leaves the family’s other actions to the table’s shared rows', () => {
        expect(describeAction(action('PassStockRound', {}))).toBeUndefined()
    })
})
