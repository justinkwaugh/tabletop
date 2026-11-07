// @vitest-environment node
import { readFileSync } from 'node:fs'
import { render } from 'svelte/server'
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
    SealAsset,
    ShillingValues,
    TargetAsset,
    WritBackAsset,
    beadAsset,
    cardAsset,
    goodAsset,
    locationAsset,
    monsterAsset,
    shillingAsset,
    strayFiles,
    tileBackAsset,
    tileFrontAsset,
    vesselAsset
} from '$lib/art/assetMap.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import MapGround from './map/MapGround.svelte'
import ActionCardFace from './pieces/ActionCardFace.svelte'
import ArcheryTarget from './pieces/ArcheryTarget.svelte'
import GoodToken from './pieces/GoodToken.svelte'
import LocationDisc from './pieces/LocationDisc.svelte'
import MonsterToken from './pieces/MonsterToken.svelte'
import SealFace from './pieces/SealFace.svelte'
import ShillingToken from './pieces/ShillingToken.svelte'
import TileFace from './pieces/TileFace.svelte'
import VesselToken from './pieces/VesselToken.svelte'
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

/** Every id's component, built from the logic's data, so a new component id must appear here. */
const shownBy = new Map<string, () => string>([
    [MapAsset, () => render(MapGround, { props: {} }).body],
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
    ...ShillingValues.map((value): [string, () => string] => [
        shillingAsset(value),
        () => render(ShillingToken, { props: { value } }).body
    ]),
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

    it('the map holds exactly the components that can be shown, plus the cover', () => {
        expect(new Set(AssetIds)).toEqual(new Set([...shownBy.keys(), CoverAsset]))
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

    it('the folder is ignored by git, so no file can be staged', () => {
        const ignore = readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8')
        expect(ignore).toMatch(/^\/src\/lib\/art\/supplied\/$/m)
    })
})

describe('the drawn cover', () => {
    const cover = readFileSync(new URL('../images/cover.webp', import.meta.url))

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

    it('is 4:5 at twice the large card, so 150 and 340 px high never upscale', () => {
        const { width, height } = webpSize(cover)
        expect(width).toBe(544)
        expect(height).toBe(680)
        expect(height).toBeGreaterThanOrEqual(340)
    })

    it('is lossy WebP within budget', () => {
        // The encoder wraps its lossy frame in an extended container to carry a colour profile.
        expect(cover.includes('VP8 ', 12, 'latin1')).toBe(true)
        expect(cover.includes('VP8L', 12, 'latin1')).toBe(false)
        expect(cover.length).toBeLessThanOrEqual(120 * 1024)
    })
})
