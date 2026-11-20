// @vitest-environment node
import { render } from 'svelte/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    EpicVoyageTrack,
    EpochTrack,
    HydratedFeudumGameState,
    MilitaryServiceTrack,
    RegionIds,
    RegionTiles,
    RegionTileChart,
    ScoreTrack
} from '@tabletop/feudum'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import { ScoreDiscSize, ScoreSpaces, barrelCentre, scoreDiscAt } from '$lib/utils/boardGeometry.js'
import TrackLayers from './TrackLayers.svelte'

const folder = vi.hoisted(() => {
    const files: Record<string, string> = {}
    return { files }
})
vi.mock('$lib/art/suppliedFiles.js', () => ({
    get suppliedFiles() {
        return folder.files
    }
}))

const paintOf = (playerId: string) => ({
    fill: `seat-${playerId}`,
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: `${playerId}'s`
})
async function table() {
    const { host } = await atPlayingCards(['explore'])
    return new HydratedFeudumGameState(structuredClone(host.state))
}

const tracks = (state: HydratedFeudumGameState) =>
    render(TrackLayers, { props: { state, paintOf } }).body

function pieceMarkup(html: string, piece: string) {
    const start = html.indexOf(`data-world="${piece}"`)
    expect(start, piece).toBeGreaterThan(-1)
    const end = html.indexOf('data-world=', start + 1)
    return html.slice(start, end === -1 ? undefined : end)
}

function count(html: string, text: string) {
    return html.split(text).length - 1
}

function emptyTheFolder() {
    for (const key of Object.keys(folder.files)) {
        delete folder.files[key]
    }
}

beforeEach(emptyTheFolder)

describe('the score ring (R-1.2.5, R-6)', () => {
    it('R-1.2.5 draws every space, labelled every five, with no board file', async () => {
        const html = tracks(await table())
        expect(count(html, 'data-score-space=')).toBe(ScoreTrack.spaces)
        expect(html).toContain('>145<')
        expect(html).not.toContain('>146<')
    })

    it('R-1.2.5 keeps every space on the printed ring, its numbers left to the print', async () => {
        Object.assign(folder.files, everyAssetSupplied())
        const html = tracks(await table())
        expect(count(html, 'data-score-space=')).toBe(ScoreTrack.spaces)
        expect(html).not.toContain('>145<')
        expect(html).not.toContain('>0<')
    })

    it('R-6 wraps a score past 149 and carries a "+150" chip on its disc', async () => {
        const state = await table()
        const [a, b] = state.players
        a.score = 163
        b.score = 12
        const html = tracks(state)
        const disc = pieceMarkup(html, `score:${a.playerId}`)
        expect(disc).toContain('data-score-chip="+150"')
        expect(disc).toContain('>+150<')
        const { x, y } = scoreDiscAt(13)
        expect(html).toContain(`transform="translate(${x} ${y})"`)
        expect(pieceMarkup(html, `score:${b.playerId}`)).not.toContain('data-score-chip')
    })

    it('R-6 pins a score under nought on the lowest space, the chip giving it', async () => {
        const state = await table()
        const [a] = state.players
        a.score = -4
        const disc = pieceMarkup(tracks(state), `score:${a.playerId}`)
        expect(disc).toContain('>-4<')
        expect(ScoreSpaces[ScoreTrack.lowest].space).toBe(ScoreTrack.lowest)
    })

    it('R-1.2.5 discs sharing a space fan along the track in turn order, each telling who is there', async () => {
        const state = await table()
        const [a, b, c] = state.players
        a.score = 31
        b.score = 31
        c.score = 22
        state.turnManager.turnOrder = [b.playerId, c.playerId, a.playerId]
        const html = tracks(state)
        const first = scoreDiscAt(31, 0, 2)
        const second = scoreDiscAt(31, 1, 2)
        const alone = scoreDiscAt(22)
        expect(html).toContain(
            `transform="translate(${first.x} ${first.y})" data-world="score:${b.playerId}"`
        )
        expect(html).toContain(
            `transform="translate(${second.x} ${second.y})" data-world="score:${a.playerId}"`
        )
        expect(html).toContain(
            `transform="translate(${alone.x} ${alone.y})" data-world="score:${c.playerId}"`
        )
        const shared = `Player discs: ${b.playerId}'s on 31, ${a.playerId}'s on 31`
        expect(pieceMarkup(html, `score:${a.playerId}`)).toContain(`<title>${shared}</title>`)
        expect(pieceMarkup(html, `score:${b.playerId}`)).toContain(`<title>${shared}</title>`)
        expect(pieceMarkup(html, `score:${c.playerId}`)).toContain(
            `<title>${c.playerId}'s player disc on 22</title>`
        )
        expect(html.indexOf(`data-world="score:${b.playerId}"`)).toBeLessThan(
            html.indexOf(`data-world="score:${a.playerId}"`)
        )
    })

    it('R-1.2.5 a disc is as wide as the band and drawn at that size', async () => {
        const html = tracks(await table())
        expect(ScoreDiscSize).toBe(40)
        expect(html).toMatch(
            /data-world="score:[^"]+"[^>]*>\s*<g[^>]*data-motion[^>]*>\s*(<!--[^>]*-->\s*)*(<g[^>]*>\s*)?(<!--[^>]*-->\s*)*<svg[^>]*width="40"/
        )
    })

    it('R-1.2.5 paints the disc from the colourizer, on separate world and motion nodes', async () => {
        const state = await table()
        const [a] = state.players
        const html = tracks(state)
        const disc = pieceMarkup(html, `score:${a.playerId}`)
        expect(disc).toContain(`seat-${a.playerId}`)
        expect(disc).toMatch(/^data-world="[^"]+"[^>]*><g[^>]*data-motion=/)
    })
})

describe('what the print already holds (R-4.3, R-4.10, R-4.11)', () => {
    it('R-4.11, R-4.3.2, R-4.10.2 draws its own plain version with no map file', async () => {
        const state = await table()
        state.regionStacks[RegionIds[0]] = []
        const html = tracks(state)
        expect(html).toContain('data-drawn-sky')
        expect(html).toContain('data-drawn-chart')
        expect(html).toContain('data-drawn-tracks')
        expect(html).toContain('data-drawn-barrel')
        expect(html).toContain('data-printed-v')
        expect(count(html, 'data-chart-row=')).toBe(RegionTileChart.length)
        expect(count(html, 'data-ray=')).toBe(EpochTrack.length)
        expect(html).toContain('data-writ-icon=')
    })

    it('R-4.11, R-4.3.2, R-4.10.2 draws no second copy over the map file', async () => {
        Object.assign(folder.files, everyAssetSupplied())
        const state = await table()
        state.regionStacks[RegionIds[0]] = []
        const html = tracks(state)
        expect(html).not.toContain('data-drawn-sky')
        expect(html).not.toContain('data-drawn-chart')
        expect(html).not.toContain('data-drawn-tracks')
        expect(html).not.toContain('data-drawn-barrel')
        expect(html).not.toContain('data-printed-v')
    })

    it('R-4.11, R-4.10.2 draws what state changes either way', async () => {
        for (const art of [false, true]) {
            emptyTheFolder()
            if (art) {
                Object.assign(folder.files, everyAssetSupplied())
            }
            const state = await table()
            const [a, b] = state.players
            a.barrel = 2
            state.voyageTrack = { [b.playerId]: 'track.voyage.2' }
            state.militaryService = { [a.playerId]: 'track.military.1' }
            state.epoch = EpochTrack[2].epoch
            const html = tracks(state)
            expect(html).toContain(`data-epoch-marker="${EpochTrack[2].ray}"`)
            expect(html).toContain(`data-barrel="${a.playerId}" data-sulfur="2"`)
            expect(html).toContain(`data-world="barrel:${a.playerId}:1"`)
            expect(html).not.toContain(`data-world="barrel:${a.playerId}:2"`)
            expect(pieceMarkup(html, `voyage:${b.playerId}`)).toContain(`seat-${b.playerId}`)
            expect(html).toContain(`data-world="service:${a.playerId}:1"`)
            expect(html).toContain('data-world="progress-die"')
        }
    })

    it("R-4.10.2 places a seat's barrel by its colour", async () => {
        const state = await table()
        const [a] = state.players
        a.barrel = 1
        const { x, y } = barrelCentre(a.color)
        expect(tracks(state)).toContain(`x="${x - 27}" y="${y - 27}"`)
    })

    it("R-4.3.1 shows each stack's top epoch and count, and the V only under an empty one", async () => {
        const state = await table()
        const [region, emptied] = RegionIds
        const fourth = RegionTiles.filter(({ epoch }) => epoch === 4).map(({ id }) => id)
        state.regionStacks[region] = fourth.slice(0, 2)
        state.regionStacks[emptied] = []
        const html = tracks(state)
        expect(html).toContain(`data-stack="${region}" data-count="2"`)
        expect(html).toContain(`data-stack="${emptied}" data-count="0"`)
        expect(html).not.toContain(`data-world="stack:${emptied}"`)
        expect(count(html, 'data-printed-v')).toBe(1)
        expect(pieceMarkup(html, `stack:${region}`)).toContain('>2<')
    })

    it("R-3.7.5 draws the track's spaces from the data with no map file", async () => {
        const html = tracks(await table())
        expect(count(html, 'data-writ-icon=')).toBe(
            EpicVoyageTrack.filter(({ writDraw }) => writDraw).length
        )
        for (const { penalty } of MilitaryServiceTrack) {
            expect(html).toContain(`>${penalty}<`)
        }
    })
})
