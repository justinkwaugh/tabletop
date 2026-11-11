// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { RoyalWrits } from '@tabletop/feudum'
import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
import EnlargedLayer from './EnlargedLayer.svelte'

const paint = {
    fill: '#336699',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    initial: 'A'
}

const Faces: readonly EnlargedFace[] = [
    { kind: 'card', faceShown: true, card: 'conquer', paint, number: 3 },
    { kind: 'card', faceShown: false, paint },
    { kind: 'writ', faceShown: true, writId: RoyalWrits[0].id },
    { kind: 'tile', faceShown: true, epoch: 2, landscape: 'orchard' },
    { kind: 'bead', faceShown: true, beadValue: 4 }
]

function layer(face: EnlargedFace): string {
    return render(EnlargedLayer, { props: { face, width: 420, onClose: () => {} } }).body
}

describe('Card preview (contract: Card preview)', () => {
    it.each(Faces)(
        'R-X.1 the enlarged $kind is its own close press, named Close; no close button stands over it',
        (face) => {
            const markup = layer(face)
            expect(markup).not.toMatch(/>\s*Close\s*</)
            const presses = markup.match(/<button[^>]*>/g) ?? []
            expect(presses.filter((press) => press.includes('data-close'))).toHaveLength(1)
            const close = presses.find((press) => press.includes('data-close')) ?? ''
            expect(close).toContain('aria-label="Close"')
            expect(close).toContain(`data-enlarged="${face.kind}"`)
            expect(markup).toContain('data-backdrop')
        }
    )
})
