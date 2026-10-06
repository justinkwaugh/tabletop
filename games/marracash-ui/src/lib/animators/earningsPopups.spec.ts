import { describe, expect, it } from 'vitest'
import { gsap } from 'gsap'
import { FountainIds, ShopIds, type MoveResult } from '@tabletop/marracash'
import { EarningsPopups } from './earningsPopups.svelte.js'

const shopId = ShopIds[0]
const result: MoveResult = {
    destinationId: FountainIds[0],
    arrivals: [],
    entries: [{ shopId, ownerId: 'owner', customers: 2, income: 500, moverCut: 200 }]
}

function preparedPopups(): EarningsPopups {
    const popups = new EarningsPopups()
    popups.prepare('move', result, 'mover')
    for (const popup of popups.popups) popups.setNode(popup.id, {})
    return popups
}

describe('EarningsPopups', () => {
    it('shows the owner’s net income first, then the mover’s cut', () => {
        expect(
            preparedPopups().popups.map(({ playerId, amount }) => ({ playerId, amount }))
        ).toEqual([
            { playerId: 'owner', amount: 300 },
            { playerId: 'mover', amount: 200 }
        ])
    })

    it('holds the move’s timeline until the last popup has risen away', () => {
        const timeline = gsap.timeline({ paused: true })
        preparedPopups().schedule(shopId, timeline, 1)
        expect(timeline.duration()).toBeCloseTo(1 + 0.15 + 0.09 + 0.08 + 0.9 + 0.3)
    })

    it('shows still popups for as long as animated ones under reduced motion', () => {
        const timeline = gsap.timeline({ paused: true })
        preparedPopups().scheduleStill(timeline, 0.2)
        expect(timeline.duration()).toBeCloseTo(0.2 + 0.09 + 0.08 + 0.9 + 0.3)
    })
})
