// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import { AssetIds, CoverAsset, assetUrl } from '$lib/art/assetMap.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import ActionCardFace from './pieces/ActionCardFace.svelte'
import GoodToken from './pieces/GoodToken.svelte'
import PawnPiece from './pieces/PawnPiece.svelte'
import SeatToken from './pieces/SeatToken.svelte'
import TokenText from './pieces/TokenText.svelte'

vi.mock('$lib/art/suppliedFiles.js', () => ({ suppliedFiles: {} }))

const paint = {
    fill: '#336699',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    initial: 'A'
}

/** The state of the tree until the commit that adds the title's art: an empty folder. */
describe('with the asset folder empty', () => {
    it('no id has a file', () => {
        expect(AssetIds.filter((id) => assetUrl(id) !== undefined)).toEqual([])
    })

    it('the catalog gets the drawn cover', () => {
        expect(assetUrl(CoverAsset)).toBeUndefined()
        expect(UiDefinition.info.thumbnailUrl).toMatch(/cover\.webp/)
    })

    it('pieces draw themselves, with no image element', () => {
        const markup = [
            render(GoodToken, { props: { good: 'iron' } }).body,
            render(ActionCardFace, {
                props: { faceShown: true, kind: 'guild', paint, number: 3, width: 240 }
            }).body,
            render(PawnPiece, { props: { paint, character: 'monk' } }).body,
            render(SeatToken, { props: { kind: 'disc', paint } }).body,
            render(TokenText, { props: { text: 'Pay 2s and 1 wood for 3 vp' } }).body
        ].join('')
        expect(markup).not.toContain('<image')
        expect(markup).toMatch(/aria-label="iron"/)
    })

    it('no source reaches into the folder but the one glob', () => {
        const pieces = readdirSync(new URL('./pieces/', import.meta.url)).map((name) =>
            readFileSync(new URL(`./pieces/${name}`, import.meta.url), 'utf8')
        )
        expect(pieces.filter((source) => source.includes('supplied'))).toEqual([])
    })
})

describe('pawns (R-4.5.1)', () => {
    it('takes the seat paint, carries its character and its seat initial', () => {
        const pawn = render(PawnPiece, { props: { paint, character: 'knight' } }).body
        expect(pawn).toContain('fill="#336699"')
        expect(pawn).toMatch(/aria-label="[^"]*knight/i)
        expect(pawn).toContain('>A<')
    })

    it('a drunk pawn tilts and carries a sulfur drop', () => {
        const pawn = render(PawnPiece, { props: { paint, character: 'knight', drunk: true } }).body
        expect(pawn).toContain('rotate(')
        expect(pawn).toMatch(/aria-label="[^"]*drunk/i)
        expect(pawn).toContain('feudum-good-sulfur')
    })
})

describe('tokens in text', () => {
    it('a good, shilling, vp, seal, bead, vessel and monster are drawn, their words kept as labels', () => {
        const markup = render(TokenText, {
            props: {
                text: 'Pay 2s and iron for 3 vp, a seal, a bead, a ship and the behemoth'
            }
        }).body
        for (const word of ['2s', 'iron', '3 vp', 'seal', 'bead', 'ship', 'behemoth']) {
            expect(markup).toContain(`aria-label="${word}"`)
        }
        expect(markup).toContain('Pay ')
    })

    it('a guild keeps its name beside its icon', () => {
        const markup = render(TokenText, { props: { text: 'Monk' } }).body
        expect(markup).toContain('aria-label="monk"')
        expect(markup).toContain('Monk')
    })
})
