// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import { Charters, Mandates, RoyalWrits } from '@tabletop/feudum'
import { WritReference } from '$lib/model/writReference.js'
import WritReferenceLayer from './table/WritReferenceLayer.svelte'

const folder = vi.hoisted(() => ({ files: {} as Record<string, string> }))
vi.mock('$lib/art/suppliedFiles.js', () => ({
    get suppliedFiles() {
        return folder.files
    }
}))

const markup = () => render(WritReferenceLayer, { props: { onClose: () => {} } }).body

/** The markup of one labelled group, up to the next group. */
function group(html: string, name: string): string {
    const start = html.indexOf(`role="group" aria-label="${name}"`)
    expect(start, name).toBeGreaterThan(-1)
    const next = html.indexOf('role="group"', start + 1)
    return html.slice(start, next > -1 ? next : undefined)
}

describe('Contract, Supply: the writ reference (R-4.4, R-7)', () => {
    it("lists every writ of the game once, mandates then charters, in the print's order", () => {
        expect(WritReference.map(({ name }) => name)).toEqual(['Mandates', 'Charters'])
        const [mandates, charters] = WritReference
        expect(mandates.writs).toEqual(Mandates.map(({ id }) => id))
        expect(charters.writs).toEqual(Charters.map(({ id }) => id))
        const listed = WritReference.flatMap(({ writs }) => writs)
        expect(listed.toSorted()).toEqual(RoyalWrits.map(({ id }) => id).toSorted())
        expect(new Set(listed).size).toBe(listed.length)
    })

    it('draws each writ once as its face, in its group', () => {
        const html = markup()
        expect(html.match(/data-reference-writ="/g)).toHaveLength(RoyalWrits.length)
        for (const { name, writs } of WritReference) {
            const inGroup = group(html, name)
            for (const writId of writs) {
                expect(html.split(`data-reference-writ="${writId}"`)).toHaveLength(2)
                expect(inGroup).toContain(`data-reference-writ="${writId}"`)
            }
        }
    })

    it('R-4.4.1 marks nothing of where a writ is: no back, no count, no held, seen or known', () => {
        const html = markup()
        expect(html).not.toContain('data-writ-back')
        expect(html).not.toMatch(/\b(held|seen|known|know|deck|odds|left)\b/i)
        expect(html).not.toContain('%')
    })
})
