import { describe, expect, it } from 'vitest'

const components = import.meta.glob<string>('./*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

const FREE_COUNT = /type="(?:range|number)"/g

/**
 * The counts still drawn as number buttons: the Chancellor's split of a short setup bank, and a
 * power's counts in its picker. Every other count is a row of the pieces themselves.
 */
const NUMBER_BUTTON_COUNTS = ['./SetupPanel.svelte', './PowerChoicePicker.svelte']

/**
 * Contract, "Choose a count": every count of warbands, favor or secrets is a row of the pieces
 * themselves (`TokenRow`), never a slider or a field; the number buttons are left only where
 * listed above.
 */
describe('count controls', () => {
    it('no component draws a slider or a number field', () => {
        const offending = Object.entries(components).flatMap(([path, source]) =>
            [...source.matchAll(FREE_COUNT)].map((match) => `${path}: ${match[0]}`)
        )
        expect(offending).toEqual([])
    })

    it('no other component draws a count as number buttons', () => {
        const numberButtons = Object.entries(components)
            .filter(([, source]) => source.includes('<CountPicker'))
            .map(([path]) => path)
            .sort()
        expect(numberButtons).toEqual([...NUMBER_BUTTON_COUNTS].sort())
    })
})
