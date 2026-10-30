import { describe, expect, it } from 'vitest'
import { BonusArrows, bonusArrow } from '@tabletop/1833ne'
import { BonusArrows1833NE } from './mapView.js'

describe('1833NE board arrows', () => {
    const printed = (boardArrow: (typeof BonusArrows1833NE)[number]) =>
        boardArrow.arrowIds ?? [boardArrow.id]

    it('prints every arrow of the rules on exactly one board arrow', () => {
        const printedIds = BonusArrows1833NE.flatMap(printed)
        expect([...printedIds].sort()).toEqual(BonusArrows.map((arrow) => arrow.id).sort())
    })

    it('shares a board arrow only between arrows of equal values', () => {
        for (const boardArrow of BonusArrows1833NE)
            for (const id of printed(boardArrow))
                expect(bonusArrow(id).values).toEqual(bonusArrow(boardArrow.id).values)
    })
})
