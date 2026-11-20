import { describe, expect, it } from 'vitest'
import { DefaultCompanyPricePresentation, shownParPrice } from './companyPresentation.js'

describe('shownParPrice', () => {
    const company = { id: 'CPR', parPrice: 71 }

    it('shows a company’s par price', () => {
        expect(shownParPrice(DefaultCompanyPricePresentation, {}, company)).toBe(71)
    })

    it('shows none once the title retires it', () => {
        const presentation = {
            ...DefaultCompanyPricePresentation,
            parRetired: (_state: object, companyId: string) => companyId === 'CPR'
        }
        expect(shownParPrice(presentation, {}, company)).toBeUndefined()
        expect(shownParPrice(presentation, {}, { id: 'GT', parPrice: 67 })).toBe(67)
    })
})
