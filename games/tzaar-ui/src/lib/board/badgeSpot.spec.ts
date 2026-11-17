import { describe, expect, it } from 'vitest'
import { badgeSpot, type StandingStack } from './badgeSpot.js'

const RADIUS = 28

// A stack on screen whose top face is `rise` above its space.
function standing(x: number, y: number, rise: number): StandingStack {
    return { center: { x, y }, top: y - rise, base: y }
}

describe('where a height badge goes', () => {
    const stack = standing(0, 0, 20)

    it('sits at the far right of the top with nothing in front', () => {
        expect(badgeSpot(stack, [], RADIUS)).toBe('right')
    })

    it('moves to the far left when a taller stack in front covers the right', () => {
        expect(badgeSpot(stack, [standing(40, 40, 80)], RADIUS)).toBe('left')
    })

    it('goes to the middle when stacks in front cover both sides', () => {
        expect(badgeSpot(stack, [standing(40, 40, 80), standing(-40, 40, 80)], RADIUS)).toBe(
            'middle'
        )
    })

    it('stays at the right when the stack in front is too low to reach it', () => {
        expect(badgeSpot(stack, [standing(40, 40, 5)], RADIUS)).toBe('right')
    })
})
