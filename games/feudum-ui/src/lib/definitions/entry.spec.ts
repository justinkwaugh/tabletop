import { describe, expect, it } from 'vitest'

const Sources = import.meta.glob<string>('/src/lib/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true
})

const Entry = '/src/lib/definitions/definition.ts'

/**
 * A module's static value imports, a bare `import '...'` included; `import type` and dynamic
 * `import()` load nothing up front.
 */
function valueImports(source: string): string[] {
    return [...source.matchAll(/^import\s+(?:(?!type\s)([\s\S]*?)\s+from\s+)?'([^']+)'/gm)].map(
        ([, names, from]) => (names ? `${names.replace(/\s+/g, ' ').trim()} from ${from}` : from)
    )
}

/** The module a specifier names in this package, by its glob key. */
function resolve(importer: string, specifier: string): string {
    const path = specifier.startsWith('$lib/')
        ? `/src/lib/${specifier.slice('$lib/'.length)}`
        : new URL(specifier, `file://${importer}`).pathname
    return path.replace(/\.js$/, '.ts')
}

/** Every import the module reaches statically, followed through this package's own modules. */
function staticGraph(entry: string): { modules: string[]; external: string[] } {
    const modules: string[] = []
    const external: string[] = []
    const queue = [entry]
    while (queue.length > 0) {
        const module = queue.shift()!
        if (modules.includes(module)) continue
        modules.push(module)
        for (const line of valueImports(Sources[module])) {
            const local = resolve(module, line.replace(/^.* from /, ''))
            if (local in Sources) queue.push(local)
            else external.push(line)
        }
    }
    return { modules, external }
}

/**
 * The site loads every title's UI entry on each signed-in page to list its library, so the
 * entry holds the title's info and its cover only, and the game comes through `runtime()`.
 */
describe('the UI entry', () => {
    it('finds its module', () => {
        expect(Sources[Entry]).toContain('UiDefinition')
    })

    it('reaches only the title info and the cover', () => {
        expect(staticGraph(Entry)).toEqual({
            modules: [Entry, '/src/lib/art/cover.ts'],
            external: ['{ FeudumInfo } from @tabletop/feudum']
        })
    })
})
