// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import type { Color } from '@tabletop/common'
import { GuildIds, HydratedFeudumGameState, type GuildId } from '@tabletop/feudum'
import { colourPaint, seatPaint } from '$lib/model/seatPaint.js'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import { BoardHeight, BoardWidth, GuildAreas, railOverRect } from '$lib/utils/boardGeometry.js'
import Board from './Board.svelte'

const session = vi.hoisted(() => {
    const current: Record<string, unknown> = {}
    return { current }
})
vi.mock('$lib/model/sessionContext.svelte.js', () => ({
    getGameSession: () => session.current
}))

async function boardOf(props: { rails?: 'beside' | 'west' | 'east' } = {}) {
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

describe('Contract, Guild standings: a rail beside each guild area (R-4.5)', () => {
    it('on a desk six rails stand in two columns beside the board, each level with its area', async () => {
        const { html } = await boardOf({ rails: 'beside' })
        const west = html.indexOf('data-guild-rails="west"')
        const surface = html.indexOf('data-board-surface')
        const east = html.indexOf('data-guild-rails="east"')
        expect(west).toBeGreaterThan(-1)
        expect(west).toBeLessThan(surface)
        expect(surface).toBeLessThan(east)
        expect(html.match(/data-guild-rail="/g)).toHaveLength(GuildIds.length)
        for (const guild of GuildIds) {
            expect(railTag(html, guild)).toContain(`top:${GuildAreas[guild].y}px`)
        }
        expect(html.indexOf('data-guild-rail="farmer"')).toBeLessThan(surface)
        expect(html.indexOf('data-guild-rail="knight"')).toBeGreaterThan(surface)
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
        const dummy = gameState.guilds.knight.rows.some(({ playerId }) => !playerId)
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
})
