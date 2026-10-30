import { describe, expect, it } from 'vitest'
import { payingRouteColors, type MapBonusArrow } from './bonusArrows.js'

describe('payingRouteColors', () => {
    const boardArrow: MapBonusArrow = {
        id: 'boston-to-montreal',
        center: { x: 0, y: 0 },
        heading: 'BOSTON to',
        footer: 'MONTREAL or OGDENSBURG',
        values: [],
        points: 'left',
        arrowIds: ['boston-to-montreal', 'boston-to-ogdensburg']
    }

    it('takes the colour of every route paid by a rules’ arrow it stands for', () => {
        expect(
            payingRouteColors(boardArrow, [
                { color: 'purple', bonusArrowIds: ['boston-to-ogdensburg'] },
                { color: 'orange' },
                { color: 'red', bonusArrowIds: ['boston-and-north', 'boston-to-montreal'] }
            ])
        ).toEqual(['purple', 'red'])
    })

    it('matches a board arrow standing for one rules’ arrow by its own id', () => {
        const { arrowIds: _printed, ...single } = boardArrow
        expect(
            payingRouteColors(single, [
                { color: 'purple', bonusArrowIds: ['boston-to-ogdensburg'] },
                { color: 'red', bonusArrowIds: ['boston-to-montreal'] }
            ])
        ).toEqual(['red'])
    })
})
