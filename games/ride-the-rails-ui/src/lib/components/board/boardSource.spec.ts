import { describe, expect, it } from 'vitest'

// Contract, Render ownership: no SVG or CSS filters, masks or endless animations on the board.
// The flight layer's animators tween the board too, so they are read with it.
const BOARD_SOURCES = import.meta.glob(
    ['./*.svelte', '../Board.svelte', '../../animators/*.ts', '!../../animators/*.spec.ts'],
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
)

const FORBIDDEN: [string, RegExp][] = [
    ['an SVG filter', /<filter\b|\bfilter\s*=/],
    ['a CSS filter', /\bfilter\s*:|backdrop-filter|\b(?:drop-shadow|blur)\(/],
    ['a mask', /<mask\b|\bmask\s*=|\bmask(?:-image)?\s*:/],
    ['an SVG animation', /<animate|<set\b/],
    [
        'an endless animation',
        /infinite|repeatCount|animate-(?:spin|ping|pulse|bounce)|\brepeat\s*:\s*-1|\byoyo\b/
    ]
]

describe('the board draws without effects', () => {
    it('reads every board layer', () => {
        expect(Object.keys(BOARD_SOURCES).length).toBeGreaterThanOrEqual(10)
    })

    for (const [what, pattern] of FORBIDDEN) {
        it(`uses no ${what.replace(/^an? /, '')}`, () => {
            for (const [file, source] of Object.entries(BOARD_SOURCES)) {
                expect(String(source), `${what} in ${file}`).not.toMatch(pattern)
            }
        })
    }
})
