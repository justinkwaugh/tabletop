import { describe, expect, it } from 'vitest'
import { Suit, siteReference } from '@tabletop/oath'
import { sentenceParts } from './siteSentence.js'

const text = (t: string) => ({ kind: 'text', text: t })

describe('scenario 53 — a site sentence draws the symbols the card library prints', () => {
    it('draws a suit and a favor as their symbols', () => {
        expect(sentenceParts('If you play a [suit:hearth] card here, you get [favor].')).toEqual([
            text('If you play a '),
            { kind: 'suit', suit: Suit.Hearth },
            text(' card here, you get '),
            { kind: 'favor' },
            text('.')
        ])
    })

    it('draws a secret and an attack die', () => {
        expect(sentenceParts('take one [secret]; add one [attackDie]')).toEqual([
            text('take one '),
            { kind: 'secret' },
            text('; add one '),
            { kind: 'attackDie' }
        ])
    })

    it('keeps a sentence with no symbols as words, the word "secret" included', () => {
        expect(sentenceParts('flip one secret on your board facedown')).toEqual([text('flip one secret on your board facedown')])
    })

    it('reads every site sentence the logic package holds', () => {
        expect(sentenceParts(siteReference('site.mountain') ?? '')).toContainEqual({ kind: 'attackDie' })
        expect(sentenceParts(siteReference('site.salt-flats') ?? '').filter((p) => p.kind !== 'text')).toEqual([{ kind: 'favor' }, { kind: 'secret' }])
    })

    it('refuses a suit it does not know', () => {
        expect(() => sentenceParts('[suit:pirate]')).toThrow('pirate is not a suit')
    })
})
