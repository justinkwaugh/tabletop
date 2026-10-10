import { describe, expect, it } from 'vitest'

const components = import.meta.glob<string>('./*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

const FREE_COUNT = /type="(?:range|number)"/g

/**
 * Contract, "Choose a count": every count is a row of number buttons (a Citizenship offer's favor
 * and secrets a row of tokens), never a slider or a field.
 */
describe('count controls', () => {
    it('no component draws a slider or a number field', () => {
        const offending = Object.entries(components).flatMap(([path, source]) =>
            [...source.matchAll(FREE_COUNT)].map((match) => `${path}: ${match[0]}`)
        )
        expect(offending).toEqual([])
    })
})
