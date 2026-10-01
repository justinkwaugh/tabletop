import { describe, expect, it } from 'vitest'
import { cardPowers } from '../data/cardPowers.js'
import { choiceSpecsFor, effectFor } from './registry.js'

/** This file loads no powers, as a module reading the registry before the runtime would. */
describe('reading a card power before the powers are loaded', () => {
    it('fails with a message naming the fix, rather than reading as "no effect"', () => {
        const captains = cardPowers('denizen.order.captains')[0]
        expect(() => effectFor(captains)).toThrow(/No Oath card powers are registered/)
        expect(() => choiceSpecsFor(captains)).toThrow(/No Oath card powers are registered/)
    })
})
