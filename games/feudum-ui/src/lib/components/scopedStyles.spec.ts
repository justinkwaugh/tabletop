import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The specs resolve packages for the browser; the compiler is loaded from its node build.
const { compile } = createRequire(import.meta.url)(
    'svelte/compiler'
) as typeof import('svelte/compiler')

const Components = import.meta.glob<string>('../**/*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** Each rule's selectors in compiled CSS, at-rule preludes and keyframe steps left out. */
function selectors(css: string): string[] {
    return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{/g)]
        .map((match) => match[1].trim())
        .filter((prelude) => !prelude.startsWith('@'))
        .flatMap((prelude) => prelude.split(/,(?![^(]*\))/).map((part) => part.trim()))
        .filter((selector) => !/^(from|to|[\d.]+%)$/.test(selector))
}

/**
 * The site keeps every title's CSS in one document, so a component's rules reach only its own
 * elements: each compiled selector carries the component's scope class.
 */
describe('component styles', () => {
    it('finds the components', () => {
        expect(Object.keys(Components).length).toBeGreaterThan(20)
    })

    it.each(Object.entries(Components))('%s styles only its own elements', (file, source) => {
        const { css } = compile(source, { filename: file, css: 'external' })
        const unscoped = selectors(css?.code ?? '').filter(
            (selector) => !selector.includes('.svelte-')
        )
        expect(unscoped).toEqual([])
    })
})
