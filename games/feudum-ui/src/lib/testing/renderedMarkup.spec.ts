import { describe, expect, it } from 'vitest'
import {
    markupProblems,
    serialisedRgb,
    type MarkupElement,
    type MarkupRules
} from './renderedMarkup.js'

const Seat = '#b91c1c'

const rules: MarkupRules = {
    seatColours: new Set([Seat, serialisedRgb(Seat)]),
    declared: (token) => token === 'feudum-ink',
    styled: (className) => className === 'text-feudum-ink',
    drawnBy: (element) => element.getAttribute('data-file') ?? undefined
}

/** Elements as the scan reads them: a tag and its attributes, from `<tag name="value" …>` lines. */
function problemsOf(markup: string): string[] {
    const elements = [...markup.matchAll(/<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/?>/g)].map(
        ([, localName, attributeText]): MarkupElement => {
            const attributes = new Map(
                [...attributeText.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [
                    name,
                    value
                ])
            )
            return {
                localName,
                getAttribute: (name) => attributes.get(name) ?? null,
                hasAttribute: (name) => attributes.has(name)
            }
        }
    )
    return markupProblems(elements, rules)
}

describe('Contract, Palette and S71: the rendered markup scan', () => {
    it.each([
        ['<svg data-file="A.svelte"><path data-file="A.svelte" fill="white" /></svg>', 'white'],
        ['<span data-file="A.svelte" style="color: #123456"></span>', '#123456'],
        ['<span data-file="A.svelte" style="fill: rgb(1, 2, 3)"></span>', 'rgb(1, 2, 3)'],
        ['<div data-file="A.svelte" class="bg-stone-700"></div>', 'bg-stone-700'],
        ['<div data-file="A.svelte" class="bg-[#343a40]"></div>', '#343a40'],
        ['<div data-file="A.svelte" style="background: black"></div>', 'background: black']
    ])('finds the raw colour in %s', (markup, raw) => {
        expect(problemsOf(markup)).toEqual([expect.stringContaining(`raw colour ${raw}`)])
    })

    it('takes a seat colour as the colourizer gave it, and the same colour written back as rgb()', () => {
        const markup = `<span data-file="A.svelte" style="fill: ${serialisedRgb(Seat)}"></span>
            <svg data-file="A.svelte" fill="${Seat}"></svg>`
        expect(problemsOf(markup)).toEqual([])
    })

    it('finds a token the root does not declare, and a token utility no stylesheet has', () => {
        expect(
            problemsOf(`<span data-file="A.svelte" style="fill: var(--feudum-nosuch)"></span>
                <span data-file="A.svelte" class="text-feudum-ink bg-feudum-ink"></span>`)
        ).toEqual([
            'A.svelte <span> style: undeclared feudum-nosuch',
            'A.svelte <span> class: no utility bg-feudum-ink'
        ])
    })

    it('finds an aria-label on an element that takes no name, and leaves one with a role', () => {
        expect(
            problemsOf(`<span data-file="A.svelte" aria-label="Ana"></span>
                <span data-file="A.svelte" role="img" aria-label="Ana"></span>
                <button data-file="A.svelte" aria-label="Close"></button>`)
        ).toEqual(['A.svelte <span>: an aria-label on an element that takes no name'])
    })

    it('reads only markup the title drew', () => {
        expect(problemsOf('<span style="color: #123456" aria-label="x"></span>')).toEqual([])
    })
})
