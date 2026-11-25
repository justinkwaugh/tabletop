import { describe, expect, it } from 'vitest'
import { pseudoLocalizeMessages, pseudoLocalizePattern } from './pseudoLocale.js'

describe('pseudoLocalizePattern', () => {
    it('accents letters, brackets the text and pads it by about a third', () => {
        expect(pseudoLocalizePattern('Log in')).toBe('[Ļöĝ îñ··]')
    })

    it('leaves placeholders, markup and escapes untouched', () => {
        expect(pseudoLocalizePattern('Hi {name}, {#link to=|/x|}go{/link} \\{x\\}')).toBe(
            '[Ĥî {name}, {#link to=|/x|}ĝö{/link} \\{ẋ\\}··]'
        )
    })
})

describe('pseudoLocalizeMessages', () => {
    it('keeps the schema and plural selectors, and accents every variant', () => {
        const messages = {
            $schema: 'https://inlang.com/schema/inlang-message-format',
            games: [
                {
                    declarations: ['input count', 'local countPlural = count: plural'],
                    selectors: ['countPlural'],
                    match: {
                        'countPlural=one': '{count} game',
                        'countPlural=other': '{count} games'
                    }
                }
            ]
        }

        expect(pseudoLocalizeMessages(messages)).toEqual({
            $schema: 'https://inlang.com/schema/inlang-message-format',
            games: [
                {
                    declarations: ['input count', 'local countPlural = count: plural'],
                    selectors: ['countPlural'],
                    match: {
                        'countPlural=one': '[{count} ĝáɱé··]',
                        'countPlural=other': '[{count} ĝáɱéš··]'
                    }
                }
            ]
        })
    })
})
