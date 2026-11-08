import { describe, expect, it } from 'vitest'
import { Presentation1846 } from './presentation.js'

describe('company prices', () => {
    it('shows no par, as shares sell at the current price (GMT rules, p. 19)', () => {
        expect(Presentation1846.companyPricePresentation?.showPar).toBe(false)
    })
})
