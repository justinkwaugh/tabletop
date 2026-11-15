import { describe, expect, it } from 'vitest'
import { toPlayer, verbFor } from './person.js'

describe('telling the viewer', () => {
    it('turns the first verb to the second person', () => {
        expect(toPlayer(true, 'bought nothing and discarded their hand')).toBe(
            'bought nothing and discarded your hand'
        )
        expect(toPlayer(true, 'discards their hand')).toBe('discard your hand')
        expect(verbFor(true, 'has nothing to explore')).toBe('have nothing to explore')
        expect(verbFor(true, 'fulfils the directive')).toBe('fulfil the directive')
        expect(verbFor(true, 'pays $2B')).toBe('pay $2B')
        expect(verbFor(true, 'renounces Warlord')).toBe('renounce Warlord')
        expect(verbFor(true, 'carries 2')).toBe('carry 2')
        expect(verbFor(true, 'starts building')).toBe('start building')
        expect(toPlayer(true, 'gives up their directive and they draw two')).toBe(
            'give up your directive and you draw two'
        )
    })

    it('leaves a phrase for another player as it is', () => {
        expect(toPlayer(false, 'discards their hand')).toBe('discards their hand')
    })
})
