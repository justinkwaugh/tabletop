import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import { placeSegments } from './placeSegments.js'

const NAMES = new Map(AUSTERLITZ.localeIds.map((locale) => [AUSTERLITZ.label(locale), locale]))

describe('the places named in a line of text', () => {
    it('are picked out with the locale each names', () => {
        expect(placeSegments('Attack from locale 72 into locale 81', NAMES)).toEqual([
            { text: 'Attack from ' },
            { text: 'locale 72', locale: 72 },
            { text: ' into ' },
            { text: 'locale 81', locale: 81 }
        ])
    })

    it('take the whole number, never a shorter one inside it', () => {
        expect(placeSegments('To locale 131.', NAMES)).toEqual([
            { text: 'To ' },
            { text: 'locale 131', locale: 131 },
            { text: '.' }
        ])
    })

    it('include the locales the map names', () => {
        const [, named] = placeSegments(`Retreat into ${AUSTERLITZ.label(23)}`, NAMES)
        expect(named).toEqual({ text: AUSTERLITZ.label(23), locale: 23 })
    })

    it('leave text naming no place as it is', () => {
        expect(placeSegments('The battle is over.', NAMES)).toEqual([
            { text: 'The battle is over.' }
        ])
    })
})
