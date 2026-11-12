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
import { GuildIconPaths, PawnCube } from '$lib/utils/pieceShapes.js'

vi.mock('$lib/art/suppliedFiles.js', () => ({ suppliedFiles: {} }))
vi.mock('$lib/art/cover.js', () => ({ suppliedCover: undefined }))

const paint = {
    fill: '#336699',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
}

/** The state of the tree until the commit that adds the title's art: an empty folder. */
describe('with the asset folder empty', () => {
    it('no id has a file', () => {
        expect(AssetIds.filter((id) => assetUrl(id) !== undefined)).toEqual([])
    })

    it("the catalog gets no cover: no drawn one stands in for the publisher's", () => {
        expect(assetUrl(CoverAsset)).toBeUndefined()
        expect(UiDefinition.info.thumbnailUrl).toBe('')
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
    it('a pawn is its wooden cube in the seat paint, seen in three-quarter view', () => {
        const pawn = render(PawnPiece, { props: { paint, character: 'knight' } }).body
        expect(pawn).toContain('data-pawn-cube')
        for (const face of ['data-cube-front', 'data-cube-top', 'data-cube-side']) {
            expect(pawn).toMatch(
                new RegExp(`${face}[^>]*fill="#336699"|fill="#336699"[^>]*${face}`)
            )
        }
        expect(pawn).toContain('aria-label="Ana\'s knight pawn"')
        expect(pawn).toContain("<title>Ana's knight pawn</title>")
    })

    it('the front face stands square-on, the top and the right side going back from it', () => {
        const { front, top, side } = PawnCube
        expect(top).toContain(`M${front.x} ${front.y} `)
        expect(top).toContain(`L${front.x + front.width} ${front.y} `)
        expect(side).toContain(`M${front.x + front.width} ${front.y} `)
        expect(side).toContain(`L${front.x + front.width} ${front.y + front.height} `)
    })

    it('its character is printed on the front face, pale with a dark outline, and no initial', () => {
        const pawn = render(PawnPiece, { props: { paint, character: 'knight' } }).body
        const face = /<path[^>]*data-cube-face[^>]*>/.exec(pawn)?.[0] ?? ''
        expect(face).toContain(`d="${GuildIconPaths.knight}"`)
        expect(face).toContain('fill="var(--feudum-parchment)"')
        expect(face).toContain('stroke="var(--feudum-ink)"')
        const { front, face: icon } = PawnCube
        expect(icon.x).toBeGreaterThanOrEqual(front.x)
        expect(icon.y).toBeGreaterThanOrEqual(front.y)
        expect(icon.x + icon.size).toBeLessThanOrEqual(front.x + front.width)
        expect(icon.y + icon.size).toBeLessThanOrEqual(front.y + front.height)
        expect(face).toContain(`translate(${icon.x} ${icon.y})`)
        expect(pawn).not.toContain('>A<')
        expect(pawn).not.toContain('<text')
    })

    it('a pawn in supply has no character yet, so its front face is bare (R-3.6)', () => {
        const pawn = render(PawnPiece, { props: { paint } }).body
        expect(pawn).toContain('data-cube-front')
        expect(pawn).not.toContain('data-cube-face')
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
