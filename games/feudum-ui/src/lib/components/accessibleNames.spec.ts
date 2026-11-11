import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The specs resolve packages for the browser; the compiler is loaded from its node build.
const { parse } = createRequire(import.meta.url)(
    'svelte/compiler'
) as typeof import('svelte/compiler')

const Components = import.meta.glob<string>('../**/*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** Elements whose implicit role takes no name: a screen reader drops an aria-label on them. */
const Unnamed = new Set([
    'b',
    'caption',
    'code',
    'del',
    'div',
    'em',
    'i',
    'ins',
    'p',
    'small',
    'span',
    'strong',
    'sub',
    'sup'
])

interface Element {
    readonly type: 'RegularElement'
    readonly name: string
    readonly start: number
    readonly attributes: readonly { readonly type: string; readonly name?: string }[]
}

function elementsOf(node: unknown, found: Element[] = []): Element[] {
    if (Array.isArray(node)) {
        node.forEach((child) => elementsOf(child, found))
    } else if (node && typeof node === 'object') {
        if ((node as { type?: unknown }).type === 'RegularElement') {
            found.push(node as Element)
        }
        for (const [key, value] of Object.entries(node)) {
            if (key !== 'parent' && key !== 'metadata') {
                elementsOf(value, found)
            }
        }
    }
    return found
}

describe('accessible names', () => {
    it('finds the components', () => {
        expect(Object.keys(Components).length).toBeGreaterThan(20)
    })

    it.each(Object.entries(Components))(
        '%s puts each aria-label on an element that can carry a name',
        (file, source) => {
            const ast = parse(source, { modern: true, filename: file })
            const dropped = elementsOf(ast.fragment)
                .filter(({ name, attributes }) => {
                    const named = attributes.some((attribute) => attribute.name === 'aria-label')
                    const role = attributes.some((attribute) => attribute.name === 'role')
                    return Unnamed.has(name) && named && !role
                })
                .map(
                    ({ name, start }) =>
                        `<${name}> at line ${source.slice(0, start).split('\n').length}`
                )
            expect(dropped).toEqual([])
        }
    )
})
