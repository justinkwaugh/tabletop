import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { BuyTrain } from '@tabletop/18xx'
import { describeAutomaticStep } from './historyAutomaticStep.js'

const purchase = (source: ActionSource, playerId?: string): BuyTrain => ({
    id: 'buy',
    gameId: 'history',
    source,
    type: 'BuyTrain',
    ...(playerId ? { playerId } : {}),
    companyId: 'B&O',
    trainId: 'train',
    definitionId: '6',
    expectedPrice: 800
})
const bought = { text: 'Bought', important: true }

it('says why a train the System bought with no player was automatic', () => {
    expect(describeAutomaticStep(purchase(ActionSource.System), bought)).toEqual({
        ...bought,
        detail: 'Automatic: no president'
    })
})

it('keeps what was already in the row’s detail', () => {
    expect(
        describeAutomaticStep(purchase(ActionSource.System), {
            ...bought,
            detail: 'C&O closed'
        }).detail
    ).toBe('C&O closed · Automatic: no president')
})

it('leaves a purchase credited to a player as it is, whoever recorded it', () => {
    expect(describeAutomaticStep(purchase(ActionSource.System, 'alex'), bought)).toEqual(bought)
    expect(describeAutomaticStep(purchase(ActionSource.User, 'alex'), bought)).toEqual(bought)
})
