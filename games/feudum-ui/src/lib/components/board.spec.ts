// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import type { Color } from '@tabletop/common'
import { HydratedFeudumGameState, knightRows, type GuildId } from '@tabletop/feudum'
import { colourPaint, seatPaint } from '$lib/model/seatPaint.js'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import {
    BoardHeight,
    BoardWidth,
    MapArea,
    railOverRect,
    standingsStripHeight
} from '$lib/utils/boardGeometry.js'
import Board from './Board.svelte'

const session = vi.hoisted(() => {
    const current: Record<string, unknown> = {}
    return { current }
})
vi.mock('$lib/model/sessionContext.svelte.js', () => ({
    getGameSession: () => session.current
}))

async function boardOf(props: { rails?: 'strip' | 'west' | 'east'; desk?: boolean } = {}) {
    const { host } = await atPlayingCards(['explore'])
    const gameState = new HydratedFeudumGameState(structuredClone(host.state))
    const colors = {
        getPlayerUiColor: () => '#102030',
        getUiColor: () => '#405060'
    }
    session.current = {
        gameState,
        boardAnimator: { tokens: [], attach: () => {} },
        myPlayerId: gameState.players[0].playerId,
        getPlayerName: (playerId: string) => playerId,
        colors,
        paintOf: (playerId: string) => seatPaint(colors, playerId, playerId),
        colourPaintOf: (colour: Color) => colourPaint(colors, colour)
    }
    return { gameState, html: render(Board, { props }).body }
}

/** The opening tag of one guild's rail. */
function railTag(html: string, guild: GuildId): string {
    const tag = html.match(new RegExp(`<div[^>]*data-guild-rail="${guild}"[^>]*>`))?.[0]
    expect(tag, guild).toBeDefined()
    return tag ?? ''
}

describe('Contract, Guild standings: a rail for each guild (R-4.5)', () => {
    it('on a desk the six rails stand in one strip under the map, across its width, the West guilds then the East, each in its area’s order', async () => {
        const { html, gameState } = await boardOf({ rails: 'strip', desk: true })
        const surface = html.indexOf('data-board-surface')
        const strip = html.match(/<div[^>]*data-guild-strip[^>]*>/)?.[0] ?? ''
        expect(strip).toContain(`width:${MapArea.width}px`)
        expect(strip).toContain(`height:${standingsStripHeight(gameState.players.length)}px`)
        expect(html.indexOf('data-guild-strip')).toBeGreaterThan(surface)
        expect(html).not.toContain('data-guild-rails')
        const order = [...html.matchAll(/data-guild-rail="([a-z]+)"/g)].map(([, guild]) => guild)
        expect(order).toEqual(['alchemist', 'merchant', 'farmer', 'knight', 'noble', 'monk'])
        expect(railTag(html, 'knight')).toContain('data-strip-east')
        expect(railTag(html, 'farmer')).not.toContain('data-strip-east')
    })

    it("on a phone a guild view carries its own three rails over the map's inner edge, and the map view none", async () => {
        const { html } = await boardOf({ rails: 'west' })
        expect(html.match(/data-guild-rail="/g)).toHaveLength(3)
        for (const guild of ['alchemist', 'merchant', 'farmer'] as const) {
            const { x, y } = railOverRect(guild)
            const tag = railTag(html, guild)
            expect(tag).toContain(`left:${x}px`)
            expect(tag).toContain(`top:${y}px`)
        }
        expect(html.indexOf('data-guild-rails="west"')).toBeGreaterThan(
            html.indexOf('data-board-surface')
        )
        expect((await boardOf()).html).not.toContain('data-guild-rail')
    })
})

describe("Board stands the layers in the contract's order (R-1.2, S72)", () => {
    it('R-1.2 draws the map, then the guild areas and the tracks, with no supply strip under them', async () => {
        const { html } = await boardOf()
        const order = [
            'ground',
            'routes',
            'locations',
            'contents',
            'pieces',
            'chips',
            'guilds',
            'tracks',
            'motion'
        ]
        const places = order.map((layer) => html.indexOf(`data-layer="${layer}"`))
        expect(places.every((place) => place > -1)).toBe(true)
        expect(places).toEqual([...places].sort((a, b) => a - b))
    })

    it('R-1.4-H1 paints a seat and a colour no seat plays from the colourizer alone', async () => {
        const { html, gameState } = await boardOf()
        expect(html).toContain('#102030')
        const dummy = knightRows(gameState).some(({ row }) => 'dummyColour' in row.owner)
        expect(html.includes('#405060')).toBe(dummy)
    })

    it('Contract, Supply: the board is its own height, with no strip under it', async () => {
        const { html } = await boardOf()
        expect(html).not.toContain('data-layer="margin"')
        expect(html).not.toContain('data-margin')
        const surface = html.match(/<svg[^>]*data-board-surface[^>]*>/)?.[0] ?? ''
        expect(surface).toContain(`height="${BoardHeight}"`)
        expect(surface).toContain(`viewBox="0 0 ${BoardWidth} ${BoardHeight}"`)
    })

    it('Contract, Desk layout: a desk draws the map alone, with no guild area, no score ring and no ring print', async () => {
        const { html } = await boardOf({ rails: 'strip', desk: true })
        const surface = html.match(/<svg[^>]*data-board-surface[^>]*>/)?.[0] ?? ''
        const { x, y, width, height } = MapArea
        expect(surface).toContain(`width="${width}"`)
        expect(surface).toContain(`height="${height}"`)
        expect(surface).toContain(`viewBox="${x} ${y} ${width} ${height}"`)
        expect(html).not.toContain('data-score-ring')
        expect(html).not.toContain('data-score-space')
        expect(html).not.toContain('board.ring')
        // The guild areas stand behind the side buttons (GuildSides), not on the desk's board.
        expect(html).not.toContain('data-layer="guilds"')
        expect(html).not.toContain('data-guild=')
        // A phone keeps the whole board, its guild areas and its ring.
        const phone = (await boardOf()).html
        expect(phone).toContain('data-score-ring')
        expect(phone).toContain('data-layer="guilds"')
    })
})
