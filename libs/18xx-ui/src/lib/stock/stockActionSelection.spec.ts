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
    it('starts a fresh branch when the action is reselected', () => {
        const previous = chooseSaleCompany(chooseStockAction('sell'), 'A')
        const next = chooseStockAction('buy')
        expect(next.saleCompany).toBeUndefined()
        expect(previous.saleCompany?.value).toBe('A')
    })
})
