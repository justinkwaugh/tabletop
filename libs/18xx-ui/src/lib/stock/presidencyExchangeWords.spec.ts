import { expect, it } from 'vitest'
import { exchangeChoiceWords } from './presidencyExchangeWords.js'

it('names a title’s certificate of several shares, and counts single ones', () => {
    const last = { shares: 2, percent: 20 }
    const single = { shares: 1, percent: 10 }
    const named = { name: 'Last certificate' }
    expect(exchangeChoiceWords([last], named)).toBe('the last certificate (20%)')
    expect(exchangeChoiceWords([single, single], named)).toBe('two 10% certificates')
    expect(exchangeChoiceWords([last, single])).toBe('one 20% certificate and one 10% certificate')
})
