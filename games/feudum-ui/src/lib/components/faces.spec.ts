// @vitest-environment node
import { render } from 'svelte/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionCardKinds, LandscapeKinds, RoyalWrits } from '@tabletop/feudum'
import { ReeveAsset, cardAsset, cardBackAsset } from '$lib/art/assetMap.js'
import { SeatPieceKinds, type SeatPaint, type SeatPieceKind } from '$lib/model/seatPaint.js'
import { handFaceShown, sealFaceShown, writFaceShown } from '$lib/model/perspective.js'
import { faceTier, shortName } from '$lib/utils/cardShape.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import ActionCardFace from './pieces/ActionCardFace.svelte'
import BoardMotionLayer from './map/BoardMotionLayer.svelte'
import MonsterToken from './pieces/MonsterToken.svelte'
import RoseChip from './pieces/RoseChip.svelte'
import SealFace from './pieces/SealFace.svelte'
import SeatToken from './pieces/SeatToken.svelte'
import TileFace from './pieces/TileFace.svelte'
import WritFace from './pieces/WritFace.svelte'

const folder = vi.hoisted(() => {
    const files: Record<string, string> = {}
    return { files }
})
vi.mock('$lib/art/suppliedFiles.js', () => ({
    get suppliedFiles() {
        return folder.files
    }
}))

const paint = {
    fill: '#336699',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
}
const Folders = [
    { name: 'no art', files: () => ({}) },
    { name: 'art', files: everyAssetSupplied }
]

function cardBack(kind: (typeof ActionCardKinds)[number]) {
    return render(ActionCardFace, {
        props: { faceShown: false, kind, paint, number: 1, width: 200 }
    }).body
}

function bodyOf(markup: string): string {
    return markup.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '')
}

describe('perspective', () => {
    it('R-3.1, R-5.1 a hand: the owner sees faces, others and a spectator backs', () => {
        expect(handFaceShown('p1', 'p1')).toBe(true)
        expect(handFaceShown('p2', 'p1')).toBe(false)
        expect(handFaceShown(undefined, 'p1')).toBe(false)
    })

    it('R-4.4.4 a writ: the holder only; R-6.2 all at final scoring', () => {
        expect(writFaceShown('p1', 'p1')).toBe(true)
        expect(writFaceShown('p2', 'p1')).toBe(false)
        expect(writFaceShown('p2', 'p1', true)).toBe(true)
    })

    it('R-5-H1 a seal red side up hides its value from its holder too', () => {
        expect(sealFaceShown(false)).toBe(false)
        expect(sealFaceShown(true)).toBe(true)
    })
})

describe.each(Folders)('faces with $name', ({ name, files }) => {
    beforeEach(() => {
        folder.files = files()
    })

    it('R-3.1 an action card back is the same for all eleven kinds, and names none', () => {
        const backs = ActionCardKinds.map(cardBack).map(bodyOf)
        expect(new Set(backs).size).toBe(1)
        for (const kind of ActionCardKinds) {
            expect(backs[0].toLowerCase()).not.toContain(kind)
        }
        expect(backs[0]).not.toContain('<image')
    })

    it('S71 an action card back and band take the seat paint, never a fixed colour', () => {
        const back = cardBack('move')
        const face = render(ActionCardFace, {
            props: { faceShown: true, kind: 'move', paint, number: 1, width: 200 }
        }).body
        expect(back).toContain('fill="#336699"')
        expect(face).toContain('fill="#336699"')
    })

    it('R-4.4.4 a writ back is the same for all sixteen writs, and names none', () => {
        const backs = RoyalWrits.map(
            ({ id }) => render(WritFace, { props: { faceShown: false, writId: id } }).body
        ).map(bodyOf)
        expect(new Set(backs).size).toBe(1)
        for (const { id } of RoyalWrits) {
            expect(backs[0]).not.toContain(id)
        }
        expect(backs[0]).not.toMatch(/mandate|charter/i)
    })

    it('R-4.4.4 a sealed writ to others carries a wax seal and still names nothing', () => {
        const back = render(WritFace, {
            props: { faceShown: false, writId: 'writ.charter.eastern-kingdom', sealed: true }
        }).body
        expect(back).toMatch(/sealed/i)
        expect(back).not.toMatch(/eastern/i)
    })

    it('R-4.4.4 a sealed writ to its owner is a dimmed face marked sealed', () => {
        const face = render(WritFace, {
            props: {
                faceShown: true,
                writId: 'writ.charter.eastern-kingdom',
                sealed: true,
                width: 200
            }
        }).body
        expect(face).toMatch(/aria-label="[^"]*Eastern[^"]*sealed/i)
        expect(face).toContain('opacity')
    })

    it('R-5-H1 a seal red side up is one disc whatever its bead, with no value in it', () => {
        const seals = ([2, 3, 4, 5] as const).map(
            (beadValue) => render(SealFace, { props: { faceShown: false, beadValue } }).body
        )
        expect(new Set(seals).size).toBe(1)
        expect(seals[0]).not.toMatch(/\+\d|bead/i)
    })

    it('R-5-H1 a bead shows its value to all', () => {
        const bead = render(SealFace, { props: { faceShown: true, beadValue: 3 } }).body
        expect(bead).toMatch(/aria-label="[^"]*\+3/)
    })

    it('Contract, seals: a seal never has a halo, a bead neither', () => {
        for (const faceShown of [false, true]) {
            const markup = render(SealFace, { props: { faceShown, beadValue: 2 } }).body
            expect(markup).not.toContain('feudum-halo')
        }
    })

    it('R-4.3 a tile unturned names no landscape, whatever is passed', () => {
        const fronts = LandscapeKinds.map(
            (landscape) =>
                render(TileFace, { props: { faceShown: false, epoch: 2, landscape } }).body
        )
        expect(new Set(fronts).size).toBe(1)
        for (const landscape of LandscapeKinds) {
            expect(fronts[0]).not.toContain(landscape)
            expect(fronts[0]).not.toContain(landscape.replace('-', ' '))
        }
    })

    it('R-4.3 a tile turned shows its landscape', () => {
        const back = render(TileFace, {
            props: { faceShown: true, epoch: 2, landscape: 'silver-mine' }
        }).body
        expect(back).toMatch(/silver mine/i)
    })

    it(`keeps every face labelled with ${name}`, () => {
        const face = render(ActionCardFace, {
            props: { faceShown: true, kind: 'tax', paint, number: 7, width: 200 }
        }).body
        expect(face).toMatch(/aria-label="[^"]*Tax/)
    })
})

describe('tiers', () => {
    it('Contract, sizes: one component by width, not a second asset', () => {
        expect(faceTier(50)).toBe('compact')
        expect(faceTier(120)).toBe('standard')
        expect(faceTier(240)).toBe('full')
    })

    beforeEach(() => {
        folder.files = {}
    })

    it('compact drops the action line; standard adds it; full adds the special ability', () => {
        const at = (width: number) =>
            render(ActionCardFace, {
                props: { faceShown: true, kind: 'move', paint, number: 1, width }
            }).body
        expect(at(50)).not.toContain('allowance')
        expect(at(120)).toContain('allowance')
        expect(at(120)).not.toContain('Godspeed')
        expect(at(240)).toContain('Godspeed')
    })
})

/** A seat whose displayed colour is the publisher's red, so its cards are the printed red cards. */
const redPaint = { ...paint, printed: Color.Red as const }

function cardAt(props: Record<string, unknown>) {
    return render(ActionCardFace, {
        props: {
            faceShown: true,
            kind: 'influence',
            paint: redPaint,
            number: 4,
            width: 200,
            ...props
        }
    }).body
}

describe('printed action cards (R-3.1)', () => {
    beforeEach(() => {
        folder.files = everyAssetSupplied()
    })

    /** The print's band and foot, measured on it: one flat colour a printed colour (`print-frame`). */
    const Band = {
        [Color.Red]: 'var(--feudum-print-frame-red)',
        [Color.Blue]: 'var(--feudum-print-frame-blue)',
        [Color.Green]: 'var(--feudum-print-frame-green)',
        [Color.Purple]: 'var(--feudum-print-frame-purple)',
        [Color.Yellow]: 'var(--feudum-print-frame-yellow)'
    } as const

    /**
     * Where each kind's art file stands in its print (580 x 938 px), found by matching the art to the
     * printed card of that kind: 0.9 of the file's size, its top left at these pixels.
     */
    const ArtAt: Record<(typeof ActionCardKinds)[number], readonly [number, number]> = {
        conquer: [14, 4],
        defend: [13, -3],
        explore: [1, 4],
        guild: [3, 3],
        harvest: [5, 5],
        improve: [7, 5],
        influence: [12, 4],
        migrate: [12, -3],
        move: [0, 4],
        repeat: [10, 4],
        tax: [8, 4]
    }

    const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

    it.each(ActionCardKinds)(
        'R-3.1 %s in a printed colour is its art in the drawn print: band and foot in the colour, the frame, the art where the print holds it',
        (kind) => {
            for (const [colour, fill] of Object.entries(Band)) {
                const face = cardAt({ kind, paint: { ...paint, printed: colour } })
                expect(face).toContain(`href="/art/${cardAsset(kind)}.webp"`)
                expect(face).not.toMatch(/card\.action\.\w+\.(red|blue|yellow|green|purple)/)
                const band = face.match(/<rect[^>]*data-print-band[^>]*>/)?.[0] ?? ''
                expect(attr(band, 'fill'), `${kind} ${colour}`).toBe(fill)
                expect([attr(band, 'width'), attr(band, 'height')]).toEqual(['580', '938'])
                expect(face).toContain('data-print-frame')
                const art = face.match(/<image[^>]*>/)?.[0] ?? ''
                expect([attr(art, 'x'), attr(art, 'y')].map(Number)).toEqual([...ArtAt[kind]])
                expect([attr(art, 'width'), attr(art, 'height')].map(Number)).toEqual([556.2, 900])
                expect(art).toMatch(/clip-path="url\(#[^)]+\)"/)
                expect(face).toMatch(/aria-label="Ana's [^"]+ card"/)
            }
        }
    )

    it('R-3.1 the drawn print stands centred in the card at the print’s proportion; its art clip is the face’s own', () => {
        const face = cardAt({})
        expect(face).toMatch(
            /<g transform="translate\(7\.51\d* 0\) scale\(0\.405\d*\)"[^>]*data-print/
        )
        const clipId = face.match(/<clipPath id="([^"]+)"/)?.[1]
        // An id from the component's own instance ($props.id), so two faces on a page never share it.
        expect(clipId).toMatch(/^s\d+-art$/)
        expect(face).toContain(`clip-path="url(#${clipId})"`)
    })

    it('R-3.1 the drawn foot names nothing: no line in the print’s other languages, so nothing to paint out', () => {
        for (const width of [50, 120, 240]) {
            expect(cardAt({ width })).not.toContain('<text')
        }
    })

    it('R-3.1 a printed back is the same for all eleven kinds, names none, and is its colour’s', () => {
        const backs = ActionCardKinds.map((kind) => bodyOf(cardAt({ faceShown: false, kind })))
        expect(new Set(backs).size).toBe(1)
        for (const kind of ActionCardKinds) {
            expect(backs[0].toLowerCase()).not.toContain(kind)
        }
        expect(backs[0]).toContain(`href="/art/${cardBackAsset(Color.Red)}.webp"`)
        expect(backs[0]).not.toContain('card.action')
        const blue = cardAt({ faceShown: false, paint: { ...paint, printed: Color.Blue } })
        expect(blue).toContain(`href="/art/${cardBackAsset(Color.Blue)}.webp"`)
    })

    it('a printed back keeps the proportion it is cut to: centred in the card, never stretched', () => {
        expect(cardAt({ faceShown: false })).toMatch(
            /<image[^>]*preserveAspectRatio="xMidYMid meet"/
        )
    })

    it('R-3.1 a printed face carries no round number badge and no short-name plate, at any size; its name stays in its accessible name and tooltip', () => {
        for (const width of [50, 120, 240]) {
            const face = cardAt({ width })
            expect(face).not.toContain('<circle')
            expect(face).not.toContain('>4<')
            expect(face).not.toContain(`>${shortName('Influence')}<`)
            expect(face).not.toMatch(/<rect[^>]*fill="var\(--feudum-parchment\)"/)
            expect(face).toContain(`aria-label="Ana's Influence card"`)
            expect(face).toContain(`<title>Ana's Influence card</title>`)
        }
    })

    it('a paint in no printed colour keeps the band round the art window, and the drawn back', () => {
        const face = cardAt({ paint })
        expect(face).toContain(`href="/art/${cardAsset('influence')}.webp"`)
        expect(face).not.toContain('data-print')
        expect(face).toContain(`fill="${paint.fill}"`)
        expect(cardAt({ faceShown: false, paint })).not.toContain('<image')
    })

    it('a printed colour with no art in the folder keeps the band round the drawn window; with no back, the drawn back', () => {
        folder.files = Object.fromEntries(
            Object.entries(everyAssetSupplied()).filter(
                ([path]) => !path.includes('card.action.influence') && !path.includes('.red.')
            )
        )
        const face = cardAt({})
        expect(face).not.toContain('data-print')
        expect(face).toContain(`fill="${paint.fill}"`)
        expect(cardAt({ faceShown: false })).not.toContain('<image')
    })
})

describe('seat pieces (S71)', () => {
    beforeEach(() => {
        folder.files = everyAssetSupplied()
    })

    const token = (kind: SeatPieceKind, piecePaint: SeatPaint = redPaint) =>
        render(SeatToken, { props: { kind, paint: piecePaint } }).body

    it('a marker is the printed hexagon and a disc the printed blank face, each drawn in the seat fill with no file', () => {
        for (const piecePaint of [redPaint, paint]) {
            const marker = token('marker', piecePaint)
            expect(marker).toMatch(/<polygon points="12,1 21.6,6.5[^"]*"[^>]*fill="#336699"/)
            const disc = token('disc', piecePaint)
            expect(disc).toMatch(/<circle cx="12" cy="12" r="10.5" fill="#336699"/)
            for (const piece of [marker, disc]) {
                expect(piece).not.toContain('<image')
                expect(piece).not.toContain('<text')
            }
        }
    })

    it('a reeve in a printed colour is a disc in the seat fill under the one shared print of its point', () => {
        for (const printed of [Color.Red, Color.Blue] as const) {
            const reeve = token('reeve', { ...paint, printed })
            expect(reeve).toMatch(/<circle cx="12" cy="12" r="10.5" fill="#336699"/)
            expect(reeve).toContain(`href="/art/${ReeveAsset}.webp"`)
            expect(reeve.indexOf('fill="#336699"')).toBeLessThan(reeve.indexOf('<image'))
            expect(reeve).not.toContain('<text')
        }
    })

    it.each(SeatPieceKinds)(
        'a %s names its seat in its accessible name and its tooltip, so colour never stands alone',
        (kind) => {
            for (const piece of [token(kind), token(kind, paint)]) {
                expect(piece).toMatch(/aria-label="Ana's [^"]+"/)
                expect(piece).toMatch(/<title>Ana's [^<]+<\/title>/)
            }
        }
    )

    it.each(SeatPieceKinds)('a %s in no printed colour is drawn in the seat fill', (kind) => {
        const piece = token(kind, paint)
        expect(piece).not.toContain('<image')
        expect(piece).toContain(`fill="${paint.fill}"`)
        expect(piece).not.toContain('<text')
    })

    it.each(SeatPieceKinds)(
        'a %s, printed or drawn, carries a dark outline and a small shadow under it',
        (kind) => {
            for (const piece of [token(kind), token(kind, paint)]) {
                expect(piece).toMatch(
                    /data-piece-outline[^>]*stroke="var\(--feudum-map-ink\)"|stroke="var\(--feudum-map-ink\)"[^>]*data-piece-outline/
                )
                expect(piece).toMatch(
                    /data-piece-shadow[^>]*transform="translate\(0 [1-9]|transform="translate\(0 [1-9][^>]*data-piece-shadow/
                )
                expect(piece.indexOf('data-piece-shadow')).toBeLessThan(
                    piece.indexOf('data-piece-outline')
                )
                expect(piece).not.toContain('filter')
                expect(piece).toContain('overflow="visible"')
            }
        }
    )

    it('a reeve whose print is not in the folder is drawn', () => {
        folder.files = Object.fromEntries(
            Object.entries(everyAssetSupplied()).filter(([path]) => !path.includes(ReeveAsset))
        )
        const piece = token('reeve')
        expect(piece).not.toContain('<image')
        expect(piece).toContain(`fill="${paint.fill}"`)
    })
})

describe('a controlled monster (R-4.2.4)', () => {
    it.each(Folders)(
        'with $name, wears its seat’s colour on a disc with no letter, and names the seat',
        ({ files }) => {
            folder.files = files()
            const monster = render(MonsterToken, {
                props: { monster: 'behemoth', paint }
            }).body
            expect(monster).toContain(`fill="${paint.fill}"`)
            expect(monster).not.toContain('<text')
            expect(monster).toMatch(/aria-label="Ana's behemoth"/)
        }
    )
})

describe('rose chips', () => {
    it('Contract, palette: a rose chip always has a label and the halo', () => {
        const chip = render(RoseChip, { props: { label: '2s' } }).body
        expect(chip).toContain('2s')
        expect(chip).toContain('feudum-halo')
        expect(chip).toContain('feudum-danger')
    })

    it('Contract, palette: a rose chip in flight keeps its label over the halo', () => {
        const flying = render(BoardMotionLayer, {
            props: {
                tokens: [
                    {
                        id: 'disloyal',
                        face: { kind: 'chip', text: '-2', rose: true },
                        place: { x: 0, y: 0 },
                        layer: 'over'
                    }
                ],
                paintOf: () => paint,
                colourPaintOf: () => paint
            }
        }).body
        expect(flying).toContain('-2')
        expect(flying).toMatch(/<rect[^>]*stroke="var\(--feudum-halo\)"/)
        expect(flying).not.toMatch(/<rect[^>]*stroke="var\(--feudum-danger\)"/)
    })

    it('Contract, palette: an empty label is refused rather than drawn as a bare shape', () => {
        expect(() => render(RoseChip, { props: { label: ' ' } }).body).toThrow('label')
    })
})
