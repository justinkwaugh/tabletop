import { describe, expect, it } from 'vitest'
import { Presentation1833NE } from './presentation.js'

describe('company prices', () => {
    it('shows no par, as shares sell at the current price (rules summary, p. 18)', () => {
        expect(Presentation1833NE.companyPricePresentation?.showPar).toBe(false)
    })
})
