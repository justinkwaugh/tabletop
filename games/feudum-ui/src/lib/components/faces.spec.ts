// @vitest-environment node
import { render } from 'svelte/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionCardKinds, LandscapeKinds, RoyalWrits } from '@tabletop/feudum'
import { handFaceShown, sealFaceShown, writFaceShown } from '$lib/model/perspective.js'
import { faceTier } from '$lib/utils/cardShape.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import ActionCardFace from './pieces/ActionCardFace.svelte'
import RoseChip from './pieces/RoseChip.svelte'
import SealFace from './pieces/SealFace.svelte'
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
    initial: 'A'
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
    it('R-3.1, R-5.1 a hand: the owner sees faces, others and the Host View backs', () => {
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

describe('rose chips', () => {
    it('Contract, palette: a rose chip always has a label and the halo', () => {
        const chip = render(RoseChip, { props: { label: '2s' } }).body
        expect(chip).toContain('2s')
        expect(chip).toContain('feudum-halo')
        expect(chip).toContain('feudum-danger')
    })

    it('Contract, palette: an empty label is refused rather than drawn as a bare shape', () => {
        expect(() => render(RoseChip, { props: { label: ' ' } }).body).toThrow('label')
    })
})
