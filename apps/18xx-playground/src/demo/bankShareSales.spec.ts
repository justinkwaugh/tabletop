import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { Definition as Shikoku, Shikoku1889StockRules } from '@tabletop/shikoku-1889'
import { cashOwnedBy, evaluateShareSale, type SellShares } from '@tabletop/18xx'
import { example } from './stockTestUtils.js'

it('pays a stock sale that exhausts the bank and reverses it on undo', () => {
    const { game, engine, state } = example(Shikoku, 'trading')
    state.stockRound.number = 2
    const bank = state.cash.find((cash) => cash.owner.kind === 'bank')!
    bank.amount = 1
    const playerId = state.activePlayerIds[0]
    const seller = { kind: 'player', playerId } as const
    const sales = [{ companyId: 'AR', shares: 1 }]
    const result = evaluateShareSale(state, { playerId, seller, sales }, Shikoku1889StockRules)
    expect(result.reason).toBeUndefined()
    const details = result.details!
    const cash = Number(cashOwnedBy(state, seller))
    const sale: SellShares = {
        id: 'bank-breaking-sale',
        gameId: state.gameId,
        source: ActionSource.User,
        type: 'SellShares',
        playerId,
        seller,
        sales,
        expectedProceeds: details.proceeds
    }
    const processed = engine.executeCanonicalAction({ game, state, action: sale })
    expect(cashOwnedBy(processed.updatedState, seller)).toBe(cash + details.proceeds)
    expect(cashOwnedBy(processed.updatedState, { kind: 'bank' })).toBe('unlimited')
    expect(processed.updatedState.bank.broken).toBe(true)
    let undone = processed.updatedState
    for (const action of [...processed.processedActions].reverse())
        undone = engine.undoProcessedAction({ state: undone, action })
    expect(undone).toEqual(state)
})

it('keeps the affordability restriction for banks that cannot exceed their cash', () => {
    const { state } = example(Shikoku, 'trading')
    state.stockRound.number = 2
    state.bank.unlimitedAfterExhaustion = false
    state.cash.find((cash) => cash.owner.kind === 'bank')!.amount = 1
    const playerId = state.activePlayerIds[0]
    const result = evaluateShareSale(
        state,
        {
            playerId,
            seller: { kind: 'player', playerId },
            sales: [{ companyId: 'AR', shares: 1 }]
        },
        Shikoku1889StockRules
    )
    expect(result.details).toBeUndefined()
    expect(result.reason).toBe('The payer cannot fund this sale.')
})
