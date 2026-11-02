import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { withoutReceiverActor } from './historyReceiver.js'
import { historyStateFixture } from './history.fixture.js'
import { historyStates } from './historyStates.js'

const action = (source: ActionSource): GameAction & { companyId: string } => ({
    id: 'buy',
    gameId: 'history',
    source,
    type: 'BuyTrain',
    playerId: 'first-in-line',
    companyId: 'B&O'
})
const states = (...receiverCompanyIds: string[]) =>
    new Map([['buy', { before: { receiverCompanyIds } }]])
const bought = { text: 'Bought', important: true }

it('credits no player with what a company in receivership did automatically', () => {
    expect(withoutReceiverActor(action(ActionSource.System), bought, states('B&O'))).toEqual({
        ...bought,
        omitActor: true,
        detail: 'Automatic: no president'
    })
})

it('keeps what was already in the row’s detail', () => {
    expect(
        withoutReceiverActor(
            action(ActionSource.System),
            { ...bought, detail: 'C&O closed' },
            states('B&O')
        ).detail
    ).toBe('C&O closed · Automatic: no president')
})

it('keeps the player for a choice they made for a company in receivership', () => {
    expect(withoutReceiverActor(action(ActionSource.User), bought, states('B&O'))).toEqual(bought)
})

it('keeps the president for a system action of a company that has one', () => {
    expect(withoutReceiverActor(action(ActionSource.System), bought, states('C&O'))).toEqual(bought)
})

it('adds nothing to a routine row, which would otherwise be shown for its detail', () => {
    const finished = { text: 'Finished operating', routine: true }
    expect(withoutReceiverActor(action(ActionSource.System), finished, states('B&O'))).toEqual({
        ...finished,
        omitActor: true
    })
})

it('records which companies were in receivership before and after each action', () => {
    const state = historyStateFixture()
    const company = state.companies[0]
    company.kind = 'major'
    company.started = true
    delete company.president
    state.certificates.push({
        id: 'president',
        kind: 'share',
        companyId: company.id,
        shares: 2,
        president: true,
        owner: { kind: 'bank' },
        poolId: 'open-market'
    })
    const recorded = { ...action(ActionSource.System), undoPatch: [] }

    expect(historyStates([recorded], state).get('buy')).toMatchObject({
        before: { receiverCompanyIds: [company.id] },
        after: { receiverCompanyIds: [company.id] }
    })
})
