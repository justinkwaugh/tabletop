import { describe, expect, it } from 'vitest'
import {
    backFromStockAction,
    chooseSaleCompany,
    chooseStockAction
} from './stockActionSelection.js'

describe('stock action selection', () => {
    it('backs out of the company before the action and keeps both manual', () => {
        const action = chooseStockAction('sell')
        const company = chooseSaleCompany(action, 'A')
        expect(company.action?.source).toBe('manual')
        expect(company.saleCompany?.source).toBe('manual')
        expect(backFromStockAction(company)).toEqual(action)
        expect(backFromStockAction(action)).toEqual({})
    })
    it('chooses the corporate buyer in the same manual step and clears it on Back', () => {
        const selection = chooseStockAction('buy', { kind: 'company', companyId: 'UB' })
        expect(selection.action?.value).toEqual({ menu: 'buy', buyer: { kind: 'company', companyId: 'UB' } })
        expect(backFromStockAction(selection)).toEqual({})
        expect(chooseStockAction('buy').action?.value.buyer).toBeUndefined()
    })
    it('starts a fresh branch when the action is reselected', () => {
        const previous = chooseSaleCompany(chooseStockAction('sell'), 'A')
        const next = chooseStockAction('buy')
        expect(next.saleCompany).toBeUndefined()
        expect(previous.saleCompany?.value).toBe('A')
    })
})
