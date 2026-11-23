// @vitest-environment node
import { addPawn } from '@tabletop/feudum/testing'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { Goods, HydratedFeudumGameState, MonsterIds, Spaces, type SpaceId } from '@tabletop/feudum'
import SiteCard from '$lib/components/table/SiteCard.svelte'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { spaceLabel } from './cardFlows.js'
import { siteCardOf } from './siteCard.js'
import { TableLayers } from './tableLayers.svelte.js'

const Names: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Bram', p3: 'Cleo' }
const nameOf = (playerId: string) => Names[playerId] ?? playerId

const paintOf = (playerId: string) => ({
    fill: `seat-${playerId}`,
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: `${nameOf(playerId)}'s`
})

/** A space with nothing on it, then what each test puts there. */
function siteWith(edit: (state: HydratedFeudumGameState, spaceId: SpaceId) => void) {
    const host = new FeudumHost(3)
    const spaceId = Spaces[5].id
    host.edit((state) => {
        for (const player of state.players) {
            for (const pawn of player.pawns) {
                if (pawn.spaceId === spaceId) {
                    delete pawn.spaceId
                    delete pawn.character
                }
            }
        }
        for (const monster of MonsterIds) {
            if (state.monsters[monster].spaceId === spaceId) {
                delete state.monsters[monster].spaceId
            }
        }
        const space = state.spaces[spaceId]
        delete space.ruler
        delete space.serf
        delete space.landscape
        for (const good of Goods) {
            space.goods[good] = 0
        }
        edit(state, spaceId)
    })
    const state = new HydratedFeudumGameState(structuredClone(host.state))
    return { card: siteCardOf(state, spaceId, nameOf), spaceId }
}

describe('the site card (R-4.1)', () => {
    it('lists its markers, its pawns by seat, and its goods by kind with their counts', () => {
        const { card, spaceId } = siteWith((state, id) => {
            const space = state.spaces[id]
            space.ruler = { playerId: 'p1', subject: true }
            space.serf = { playerId: 'p2', immune: true }
            space.goods.iron = 3
            space.goods.food = 1
            addPawn(state, 'p1', 'knight', id)
            addPawn(state, 'p2', 'farmer', id)
            addPawn(state, 'p1', 'monk', id)
        })
        expect(card.title.startsWith(`${spaceLabel(spaceId)} · `)).toBe(true)
        expect(card.markers.map(({ label, name }) => `${label} ${name}`)).toEqual([
            'Ruler Ana',
            'Subject Ana',
            'Serf Bram'
        ])
        expect(card.markers.map(({ immune }) => immune)).toEqual([false, false, true])
        expect(card.pawns.map(({ name, label }) => `${name} ${label}`)).toEqual([
            'Ana Knight, Monk',
            'Bram Farmer'
        ])
        expect(card.goods).toEqual([
            { good: 'iron', count: 3 },
            { good: 'food', count: 1 }
        ])
    })

    it('an empty site lists only its title', () => {
        const { card } = siteWith(() => {})
        expect(card.markers).toEqual([])
        expect(card.pawns).toEqual([])
        expect(card.goods).toEqual([])
        expect(card.vessels).toEqual([])
    })

    it('draws each row with its pieces and its words, each seat as its chip', () => {
        const { card } = siteWith((state, id) => {
            state.spaces[id].ruler = { playerId: 'p1', subject: false }
            state.spaces[id].goods.wood = 2
            addPawn(state, 'p3', 'noble', id)
        })
        const html = render(SiteCard, { props: { card, paintOf } }).body
        expect(html).toContain(card.title)
        expect(html).toMatch(/>Ruler<\/span>\s*(<!--[^>]*-->)*\s*<span[^>]*data-seat-chip="Ana"/)
        expect(html).toContain('aria-label="Ana\'s influence marker"')
        expect(html).toMatch(/data-site-pawns[\s\S]*data-seat-chip="Cleo"[\s\S]*>Noble</)
        expect(html).toContain('data-pawn-cube')
        expect(html).toMatch(/data-site-good="wood"[\s\S]*?2/)
    })
})

describe('the site card layer', () => {
    it('opens on a press and closes on a second, or on Escape', () => {
        const layers = new TableLayers()
        layers.openSite('space.forest.1')
        expect(layers.site).toBe('space.forest.1')
        layers.openSite('space.forest.1')
        expect(layers.site).toBeUndefined()
        layers.openSite('space.forest.2')
        expect(layers.escape()).toBe(true)
        expect(layers.site).toBeUndefined()
        expect(layers.escape()).toBe(false)
    })

    it('shows the hovered site while none is pressed, and the pressed one over it', () => {
        const layers = new TableLayers()
        layers.hoverSite('space.forest.1')
        expect(layers.site).toBe('space.forest.1')
        layers.openSite('space.forest.2')
        layers.hoverSite('space.forest.3')
        expect(layers.site).toBe('space.forest.2')
        layers.hoverSite(undefined)
        layers.closeSite()
        expect(layers.site).toBeUndefined()
    })

    it('gives way to a seat, a stack or a sheet', () => {
        const layers = new TableLayers()
        layers.openSite('space.forest.1')
        layers.openSeat('p1')
        expect(layers.site).toBeUndefined()
    })
})
