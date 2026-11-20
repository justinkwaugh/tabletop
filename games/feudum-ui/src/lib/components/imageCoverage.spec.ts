// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { render } from 'svelte/server'
import { Color } from '@tabletop/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ActionCardKinds,
    GuildIds,
    Goods,
    LandscapeKinds,
    MonsterIds,
    RoyalWrits,
    TileEpochs,
    VesselTypes
} from '@tabletop/feudum'
import {
    AssetIds,
    BeadValues,
    CoverAsset,
    MapAsset,
    PrintedColours,
    ringPartAsset,
    ReeveAsset,
    SealAsset,
    TargetAsset,
    WritBackAsset,
    beadAsset,
    cardAsset,
    cardBackAsset,
    goodAsset,
    guildFaceAsset,
    guildPanelAsset,
    locationAsset,
    monsterAsset,
    shillingAsset,
    strayFiles,
    tileBackAsset,
    tileFrontAsset,
    vesselAsset
} from '$lib/art/assetMap.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import GuildPanel from './guilds/GuildPanel.svelte'
import GuildFaces from './table/GuildFaces.svelte'
import MapGround from './map/MapGround.svelte'
import ActionCardFace from './pieces/ActionCardFace.svelte'
import ArcheryTarget from './pieces/ArcheryTarget.svelte'
import GoodToken from './pieces/GoodToken.svelte'
import LocationDisc from './pieces/LocationDisc.svelte'
import MonsterToken from './pieces/MonsterToken.svelte'
import SealFace from './pieces/SealFace.svelte'
import SeatToken from './pieces/SeatToken.svelte'
import ShillingToken from './pieces/ShillingToken.svelte'
import TileFace from './pieces/TileFace.svelte'
import VesselToken from './pieces/VesselToken.svelte'
import WritFace from './pieces/WritFace.svelte'
import BoardFrame from './tracks/BoardFrame.svelte'
import { RingParts } from '$lib/art/ringPieces.js'

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

/** Every id's component, built from the logic's data, so a new component id must appear here. */
const shownBy = new Map<string, () => string>([
    [MapAsset, () => render(MapGround, { props: {} }).body],
    ...RingParts.map(({ part }): [string, () => string] => [
        ringPartAsset(part),
        () => render(BoardFrame, { props: {} }).body
    ]),
    ...GuildIds.map((guild): [string, () => string] => [
        guildPanelAsset(guild),
        () => render(GuildPanel, { props: { guild } }).body
    ]),
    [SealAsset, () => render(SealFace, { props: { faceShown: false } }).body],
    [TargetAsset, () => render(ArcheryTarget, { props: {} }).body],
    [WritBackAsset, () => render(WritFace, { props: { faceShown: false } }).body],
    ...Goods.map((good): [string, () => string] => [
        goodAsset(good),
        () => render(GoodToken, { props: { good } }).body
    ]),
    ...VesselTypes.map((vessel): [string, () => string] => [
        vesselAsset(vessel),
        () => render(VesselToken, { props: { vessel } }).body
    ]),
    ...MonsterIds.map((monster): [string, () => string] => [
        monsterAsset(monster),
        () => render(MonsterToken, { props: { monster } }).body
    ]),
    // Every shilling the table and its text draw is a single one (`tokenText.ts`).
    [shillingAsset(1), () => render(ShillingToken, { props: { value: 1 } }).body],
    ...BeadValues.map((value): [string, () => string] => [
        beadAsset(value),
        () => render(SealFace, { props: { faceShown: true, beadValue: value } }).body
    ]),
    ...TileEpochs.map((epoch): [string, () => string] => [
        tileFrontAsset(epoch),
        () => render(TileFace, { props: { faceShown: false, epoch } }).body
    ]),
    ...LandscapeKinds.map((landscape): [string, () => string] => [
        tileBackAsset(landscape),
        () => render(TileFace, { props: { faceShown: true, epoch: 1, landscape } }).body
    ]),
    ...ActionCardKinds.map((kind): [string, () => string] => [
        cardAsset(kind),
        () =>
            render(ActionCardFace, {
                props: { faceShown: true, kind, paint, number: 1, width: 200 }
            }).body
    ]),
    ...PrintedColours.map((printed): [string, () => string] => [
        cardBackAsset(printed),
        () =>
            render(ActionCardFace, {
                props: { faceShown: false, paint: { ...paint, printed }, width: 200 }
            }).body
    ]),
    [
        ReeveAsset,
        () =>
            render(SeatToken, { props: { kind: 'reeve', paint: { ...paint, printed: Color.Red } } })
                .body
    ],
    ...(['outpost', 'farm', 'town'] as const).map((kind): [string, () => string] => [
        locationAsset(kind),
        () => render(LocationDisc, { props: { kind } }).body
    ]),
    ...GuildIds.map((guild): [string, () => string] => [
        locationAsset('feudum', guild),
        () => render(LocationDisc, { props: { kind: 'feudum', guild } }).body
    ]),
    ...RoyalWrits.map(({ id }): [string, () => string] => [
        id,
        () => render(WritFace, { props: { faceShown: true, writId: id, width: 200 } }).body
    ])
])

/** Readiness gate on images; the asset map: every id has a component, a fallback and a file slot. */
describe('image coverage (R-1.1)', () => {
    beforeEach(() => {
        folder.files = {}
    })

    it('the map holds exactly the components that can be shown, plus the cover and the guild faces', () => {
        expect(new Set(AssetIds)).toEqual(
            new Set([...shownBy.keys(), CoverAsset, ...GuildIds.map(guildFaceAsset)])
        )
    })

    it('a guild button shows each face’s file when the folder holds it, and no face without; a face is decoration, with no label of its own', () => {
        const faces = () =>
            (['west', 'east'] as const)
                .map((side) => render(GuildFaces, { props: { side } }).body)
                .join('')
        expect(faces()).not.toContain('<img')
        folder.files = everyAssetSupplied()
        const markup = faces()
        for (const guild of GuildIds) {
            expect(markup).toContain(`src="/art/${guildFaceAsset(guild)}.webp"`)
        }
        expect(markup).not.toContain('board.guild')
        expect(markup).not.toMatch(/aria-label/)
    })

    it('no id repeats', () => {
        expect(new Set(AssetIds).size).toBe(AssetIds.length)
    })

    it.each([...shownBy.keys()])('%s draws a labelled fallback with no file', (id) => {
        const markup = shownBy.get(id)?.() ?? ''
        expect(markup).toMatch(/aria-label="[^"]+"/)
        expect(markup).not.toContain('<image')
    })

    it.each([...shownBy.keys()])('%s shows its file when the folder holds it', (id) => {
        folder.files = everyAssetSupplied()
        expect(shownBy.get(id)?.() ?? '').toContain(`href="/art/${id}.webp"`)
    })

    it('a file no id asks for is reported', () => {
        expect(
            strayFiles({ './supplied/good.iron.png': 'a', './supplied/goods.png': 'b' })
        ).toEqual(['./supplied/goods.png'])
    })

    it('the real folder holds nothing the map does not know', async () => {
        const real = await vi.importActual<{ suppliedFiles: Record<string, string> }>(
            '$lib/art/suppliedFiles.js'
        )
        expect(strayFiles(real.suppliedFiles)).toEqual([])
    })

    it('git ignores the cover sources, not the supplied art', () => {
        const ignore = readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8')
        expect(ignore).toMatch(/^\/src\/lib\/art\/cover-source\/$/m)
        expect(ignore).not.toMatch(/art\/supplied/)
    })
})

/** A lossy WebP's frame header: 14 bit dimensions after the start code. */
function webpSize(file: Buffer): { width: number; height: number; format: string } {
    const chunk = file.toString('latin1', 12, 16)
    if (chunk === 'VP8 ') {
        return {
            format: chunk,
            width: file.readUInt16LE(26) & 0x3fff,
            height: file.readUInt16LE(28) & 0x3fff
        }
    }
    return {
        format: chunk,
        width: (file.readUIntLE(24, 3) & 0xffffff) + 1,
        height: (file.readUIntLE(27, 3) & 0xffffff) + 1
    }
}

/** The four-letter names of a WebP's RIFF chunks, in order. */
function webpChunks(file: Buffer): string[] {
    const chunks: string[] = []
    for (let at = 12; at + 8 <= file.length;) {
        const size = file.readUInt32LE(at + 4)
        chunks.push(file.toString('latin1', at, at + 4))
        at += 8 + size + (size % 2)
    }
    return chunks
}

const suppliedCover = new URL('../art/supplied/cover.webp', import.meta.url)

/** The catalog's one cover is the publisher's, checked where the folder holds it; none is drawn. */
describe('the supplied cover', () => {
    const here = existsSync(suppliedCover)
    const cover = () => readFileSync(suppliedCover)

    it('stands alone: no drawn cover is committed beside it', () => {
        expect(existsSync(new URL('../images/cover.webp', import.meta.url))).toBe(false)
    })

    it.skipIf(!here)('is 4:5 at twice the large card, so 150 and 340 px high never upscale', () => {
        const { width, height } = webpSize(cover())
        expect(width).toBe(544)
        expect(height).toBe(680)
        expect(height).toBeGreaterThanOrEqual(340)
    })

    it.skipIf(!here)('is lossy WebP within budget', () => {
        // The encoder wraps its lossy frame in an extended container to carry a colour profile.
        expect(cover().includes('VP8 ', 12, 'latin1')).toBe(true)
        expect(cover().includes('VP8L', 12, 'latin1')).toBe(false)
        expect(cover().length).toBeLessThanOrEqual(120 * 1024)
    })
})

const suppliedFolder = new URL('../art/supplied/', import.meta.url)
const suppliedHere = existsSync(suppliedFolder)

/**
 * The long side, in CSS px, at which each supplied picture is drawn largest: an enlarged card,
 * writ, tile or bead at 420 px wide; an enlarged guild area at 640 px; the board at its scale cap of 1; a seat
 * panel at its reading scale. The art plan's table gives each.
 */
const LargestRender: readonly [prefix: string, px: number][] = [
    ['card.action.', 640],
    ['card.back.', 640],
    ['writ.', 638],
    ['tile.', 420],
    ['bead.', 420],
    ['seal', 420],
    ['board.ring', 2500],
    ['board.map', 1598],
    ['board.guild.', 640],
    ['face.', 36],
    ['cover', 340],
    ['good.', 47],
    ['shilling.', 47],
    ['location.', 61],
    ['monster.', 67],
    ['vessel.', 40],
    ['target.', 34],
    ['piece.reeve', 15]
]

/** Readiness gate on images: about twice the largest render serves a HiDPI screen; more is waste. */
describe.skipIf(!suppliedHere)('the supplied pictures', () => {
    const files = suppliedHere
        ? readdirSync(suppliedFolder).filter((file) => file.endsWith('.webp'))
        : []

    it.each(files)('R-1.1 %s is at most 2.5 times its largest render', (file) => {
        const id = file.replace(/\.webp$/, '')
        const largest = LargestRender.find(([prefix]) => id.startsWith(prefix))?.[1]
        expect(largest, `${id} has a largest render`).toBeDefined()
        const { width, height } = webpSize(readFileSync(new URL(file, suppliedFolder)))
        expect(Math.max(width, height)).toBeLessThanOrEqual(2.5 * (largest ?? 0))
    })

    // An sRGB profile tells the browser only what it assumes already: each file ships without one.
    it.each(files)('%s carries no colour profile', (file) => {
        const bytes = readFileSync(new URL(file, suppliedFolder))
        expect(webpChunks(bytes)).not.toContain('ICCP')
        // Nor does an extended header say it has one.
        if (webpChunks(bytes)[0] === 'VP8X') {
            expect(bytes[20] & 0x20).toBe(0)
        }
    })

    /**
     * The publisher's files carry the print's bleed and its cut line: a dashed rectangle on each
     * printed card back, a die ring round the archery target. Each is cut just inside its line,
     * every printed back to one size, the proportion of the card art.
     */
    type Cut = [id: string, width: number, height: number]
    const cutInsideTheLine: readonly Cut[] = [
        ...PrintedColours.map((colour): Cut => [cardBackAsset(colour), 580, 938]),
        [TargetAsset, 64, 64]
    ]

    it.each(GuildIds.map(guildFaceAsset))(
        '%s is a lossy 72 x 72 cut, twice the 36 px circle a guild button draws it in',
        (id) => {
            const file = readFileSync(new URL(`${id}.webp`, suppliedFolder))
            expect(webpSize(file)).toMatchObject({ width: 72, height: 72 })
            expect(file.includes('VP8 ', 12, 'latin1')).toBe(true)
            expect(file.includes('VP8L', 12, 'latin1')).toBe(false)
        }
    )

    it.each(cutInsideTheLine)(
        '%s is cut inside its print line, at %i x %i',
        (id, width, height) => {
            const file = readFileSync(new URL(`${id}.webp`, suppliedFolder))
            expect(webpSize(file)).toMatchObject({ width, height })
        }
    )

    it.each(RingParts)(
        'R-1.1 the ring part $part: its file holds only that part',
        ({ part, file }) => {
            const bytes = readFileSync(new URL(`${ringPartAsset(part)}.webp`, suppliedFolder))
            expect(webpSize(bytes)).toMatchObject({ width: file[2], height: file[3] })
        }
    )
})
