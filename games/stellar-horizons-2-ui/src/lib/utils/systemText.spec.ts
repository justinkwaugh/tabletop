import { describe, expect, it } from 'vitest'
import { plainSystemText, systemRef, systemTextSegments } from './systemText.js'

describe('system references', () => {
    const text = `explored ${systemRef('alpha-centauri')} and ${systemRef('61-cygni')}.`

    it('split text into plain runs and the systems it names', () => {
        expect(systemTextSegments(text)).toEqual([
            { text: 'explored ' },
            { systemId: 'alpha-centauri' },
            { text: ' and ' },
            { systemId: '61-cygni' },
            { text: '.' }
        ])
        expect(systemTextSegments('no systems')).toEqual([{ text: 'no systems' }])
    })

    it('read as names where no link can go', () => {
        expect(plainSystemText(text)).toBe('explored Alpha Centauri and 61 Cygni.')
    })
})
