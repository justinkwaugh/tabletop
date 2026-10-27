import { describe, expect, it } from 'vitest'
import { namedPlaceText, placeReference, placeTextSegments } from './placeReferences.js'

describe('place references', () => {
    const text = `Blocks ${placeReference('I13')} and ${placeReference('I15')} while player-owned.`

    it('splits text around each referenced location', () => {
        expect(placeTextSegments(text)).toEqual([
            { text: 'Blocks ' },
            { locationId: 'I13' },
            { text: ' and ' },
            { locationId: 'I15' },
            { text: ' while player-owned.' }
        ])
    })

    it('leaves text without references whole', () => {
        expect(placeTextSegments('Closes at phase 5.')).toEqual([{ text: 'Closes at phase 5.' }])
    })

    it('names each referenced location', () => {
        const names: Record<string, string> = { I15: 'Baltimore' }
        expect(namedPlaceText(text, (id) => names[id] ?? id)).toBe(
            'Blocks I13 and Baltimore while player-owned.'
        )
    })
})
