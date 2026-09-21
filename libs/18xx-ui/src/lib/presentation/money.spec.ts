import { expect, it } from 'vitest'
import { cashText, moneyFormat, optionalMoney } from './money.js'

it('writes an amount with the title’s symbol before or after it, grouping thousands', () => {
    expect(moneyFormat('¥')(1100)).toBe('¥1,100')
    expect(moneyFormat('$')(0)).toBe('$0')
    expect(moneyFormat(' kr', 'after')(7000)).toBe('7,000 kr')
    expect(moneyFormat('M', 'after')(80)).toBe('80M')
})

it('writes cash that is unlimited or absent, and leaves a missing amount blank', () => {
    const yen = moneyFormat('¥')
    expect(cashText(yen, 420)).toBe('¥420')
    expect(cashText(yen, 'unlimited')).toBe('∞')
    expect(cashText(yen, undefined)).toBe('—')
    expect(optionalMoney(yen, undefined)).toBe('')
    expect(optionalMoney(yen, 65)).toBe('¥65')
})
