import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestPlayerId,
    minimalCompanyRules,
    minimalPlayState,
    minimalStockRules
} from '@tabletop/18xx/testing'
import { StockModule, type StockSession } from './stockModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const player = { kind: 'player', playerId: TestPlayerId } as const
const sale = {
    playerId: TestPlayerId,
    seller: player,
    sales: [{ companyId: TestCompanyId, shares: 1 }]
}
const start = { playerId: TestPlayerId, buyer: player, companyId: TestCompanyId }

function trading(valid: string[] = [], availability = {}) {
    const state: StockSession['state'] = { ...minimalPlayState(), machineState: 'StockRound' }
    let cancelled = 0
    const harness = testSession(
        state,
        { stockRules: minimalStockRules, companyRules: minimalCompanyRules },
        valid,
        availability
    )
    const module = new StockModule(harness.session, () => cancelled++)
    return { ...harness, module, cancelled: () => cancelled }
}

describe('StockModule', () => {
    it('Undo steps back from the sale company to the menu, then closes the menu', () => {
        const { module } = trading()
        module.chooseMenu('sell')
        module.chooseSaleCompany(TestCompanyId)
        expect(module.openMenu).toBe('sell')
        expect(module.selectedSaleCompany).toBe(TestCompanyId)
        expect(module.undo()).toBe(true)
        expect(module.selectedSaleCompany).toBeUndefined()
        expect(module.openMenu).toBe('sell')
        expect(module.undo()).toBe(true)
        expect(module.openMenu).toBeUndefined()
        expect(module.undo()).toBe(false)
    })

    it('Undo drops a staged sale together with its company in one step', () => {
        const { module, cancelled } = trading()
        module.chooseMenu('sell')
        module.chooseSaleCompany(TestCompanyId)
        module.selectSale(sale)
        const before = cancelled()
        expect(module.undo()).toBe(true)
        expect(module.selectedSale).toBeUndefined()
        expect(module.selectedSaleCompany).toBeUndefined()
        expect(module.openMenu).toBe('sell')
        expect(cancelled()).toBe(before + 1)
    })

    it('does not let Undo consume a menu the session reopened automatically', () => {
        const { module } = trading()
        module.menu.choose('action', { menu: 'sell' }, 'auto')
        expect(module.openMenu).toBe('sell')
        expect(module.hasManual()).toBe(false)
        expect(module.undo()).toBe(false)
        module.chooseSaleCompany(TestCompanyId)
        expect(module.undo()).toBe(true)
        expect(module.openMenu).toBe('sell')
    })

    it('carries a corporate buyer with the menu and drops it when the menu closes', () => {
        const { module } = trading()
        const buyer = { kind: 'company', companyId: 'UB' } as const
        module.chooseMenu('buy', buyer)
        expect(module.menuBuyer).toEqual(buyer)
        module.chooseMenu(undefined)
        expect(module.menuBuyer).toBeUndefined()
        expect(module.hasManual()).toBe(false)
    })

    it('choosing a menu cancels the staged trade and tells the session', () => {
        const { module, cancelled } = trading()
        module.selectSale(sale)
        expect(module.hasSelection).toBe(true)
        module.chooseMenu('buy')
        expect(module.hasSelection).toBe(false)
        expect(cancelled()).toBe(1)
    })

    it('stages a company start as company then price, and Undo unwinds them one at a time', () => {
        const { module } = trading()
        module.selectSale(sale)
        module.selectCompanyStart(start)
        expect(module.selectedSale).toBeUndefined()
        expect(module.selectedStartCompany).toEqual(start)
        module.selectStartPrice('0:1')
        expect(module.selectedStartResult).toBeDefined()
        expect(module.undo()).toBe(true)
        expect(module.selectedStartResult).toBeUndefined()
        expect(module.selectedStartCompany).toEqual(start)
        expect(module.undo()).toBe(true)
        expect(module.hasSelection).toBe(false)
        expect(() => module.selectStartPrice('0:1')).toThrow()
    })

    it('stages one company per sale and removes it by company', () => {
        const { module } = trading()
        module.selectSale(sale)
        expect(module.selectedSale).toEqual(sale)
        expect(module.selectedSaleResult?.reason).toBeDefined()
        module.removeSale(TestCompanyId)
        expect(module.hasSelection).toBe(false)
        expect(() =>
            module.selectSale({ ...sale, sales: [...sale.sales, { companyId: 'S', shares: 1 }] })
        ).toThrow()
    })

    it('refuses a purchase the rules do not allow, a trade for another player, and any trade while not interactive', () => {
        const purchase = { playerId: TestPlayerId, buyer: player, certificateId: 'missing' }
        expect(() => trading().module.selectPurchase(purchase)).toThrow()
        expect(() => trading().module.selectSale({ ...sale, playerId: 'blake' })).toThrow()
        expect(() => trading([], { interactive: false }).module.chooseMenu('buy')).toThrow()
    })

    it('hides staged choices while selections are hidden but still reports them as pending', () => {
        const { module } = trading([], { selectionsVisible: false })
        module.chooseMenu('sell')
        module.selectSale(sale)
        expect(module.openMenu).toBeUndefined()
        expect(module.selectedSale).toBeUndefined()
        expect(module.hasManual()).toBe(true)
        module.clear()
        expect(module.hasManual()).toBe(false)
    })

    it('finishes the turn only with nothing staged', async () => {
        const { module, applied } = trading(['FinishStockTurn'])
        module.selectSale(sale)
        await expect(module.finishTurn()).rejects.toThrow()
        module.cancel()
        await module.finishTurn()
        expect(applied.map((action) => action.type)).toEqual(['FinishStockTurn'])
    })
})
