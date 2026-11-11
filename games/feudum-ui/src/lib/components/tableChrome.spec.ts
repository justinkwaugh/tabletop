// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import { HydratedFeudumGameState, RegionIds, StartingSpaceIds } from '@tabletop/feudum'
import { PlainChrome, type BoardChrome } from '$lib/model/boardChrome.js'
import { guildTarget, markerTarget, spaceTarget, stackTarget } from '$lib/model/boardOffer.js'
import type { BoardOffer } from '$lib/model/boardOffer.js'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import MapLayers from './map/MapLayers.svelte'
import PickChrome from './map/PickChrome.svelte'
import RegionStacks from './tracks/RegionStacks.svelte'

const A = StartingSpaceIds[0]

describe('Board chrome (contract: Pick conventions, Board surface)', () => {
    const paintOf = () => ({
        fill: 'var(--feudum-map-ink)',
        ink: 'var(--feudum-map-ink)',
        edge: 'var(--feudum-map-ink)',
        owner: "Ana's"
    })

    function chromeWith(targets: BoardOffer['targets'], dimsRest = true): BoardChrome {
        return {
            ...PlainChrome,
            offer: { targets, dimsRest },
            press: vi.fn(),
            openStack: vi.fn()
        }
    }

    it('R-3.9 Lit, picked and being-decided each draw their ring; only a pick takes a press', () => {
        const at = { x: 10, y: 10 }
        const of = (role: 'lit' | 'picked' | 'being-decided' | 'dimmed') =>
            render(PickChrome, {
                props: {
                    target: spaceTarget(A),
                    chrome: chromeWith(new Map([[spaceTarget(A), { role }]])),
                    at,
                    width: 40,
                    label: 'A'
                }
            }).body

        expect(of('lit')).toContain('role="button"')
        expect(of('lit')).toContain('var(--feudum-accent)')
        expect(of('picked')).toContain('aria-pressed="true"')
        expect(of('being-decided')).toContain('var(--feudum-decided)')
        expect(of('being-decided')).not.toContain('role="button"')
        expect(of('dimmed')).not.toContain('role="button"')
        expect(of('dimmed')).not.toContain('var(--feudum-accent)')
    })

    it('R-3.9 A chip is anchored to its target, rose for a cost', () => {
        const html = render(PickChrome, {
            props: {
                target: spaceTarget(A),
                chrome: chromeWith(
                    new Map([
                        [
                            spaceTarget(A),
                            { role: 'lit', chip: { kind: 'cost', label: '2s', tone: 'rose' } }
                        ]
                    ])
                ),
                at: { x: 0, y: 0 },
                width: 40,
                label: 'A'
            }
        }).body
        expect(html).toContain('data-chip="rose"')
        expect(html).toContain('2s')
    })

    it('R-3.6.1 A chip that costs goods draws them, each with its count; the words stay its name', () => {
        const chip = {
            kind: 'cost',
            label: '1 food',
            goods: [{ good: 'food', count: 1 }],
            tone: 'rose'
        } as const
        const html = render(PickChrome, {
            props: {
                target: spaceTarget(A),
                chrome: chromeWith(new Map([[spaceTarget(A), { role: 'lit', chip }]])),
                at: { x: 0, y: 0 },
                width: 40,
                label: 'A'
            }
        }).body
        expect(html).toContain('data-chip="rose"')
        expect(html).toContain('aria-label="1 food"')
        expect(html).toContain('aria-label="food"')
        expect(html).toMatch(/<text[^>]*>1<\/text>/)
        expect(html).not.toMatch(/<text[^>]*>1 food<\/text>/)
    })

    it('R-1.2 Each layer dims its own unlit elements; there is no scrim over the board', async () => {
        const host = new FeudumHost(3)
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const chrome = chromeWith(new Map([[spaceTarget(A), { role: 'lit' }]]))
        const html = render(MapLayers, { props: { state, paintOf, chrome } }).body

        expect(html).toMatch(/data-layer="ground"[^>]*opacity="0\.4"/)
        expect(html).toContain(`data-pick="${spaceTarget(A)}"`)
        expect(html).toContain('data-pick-role="lit"')
        expect(html).toContain('data-pick-role="dimmed"')
        expect(html).not.toContain('--feudum-dim')
    })

    it('R-1.2 At rest a layer draws no ring, no dim and no press', async () => {
        const host = new FeudumHost(3)
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const html = render(MapLayers, { props: { state, paintOf } }).body

        expect(html).not.toContain('opacity="0.4"')
        expect(html).not.toContain('role="button"')
        expect(html).toContain('data-pick-role="plain"')
    })

    it('R-4.3.1 A stack opens its view on a press unless a pick lights it', async () => {
        const host = new FeudumHost(3)
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const [region] = RegionIds
        const html = render(RegionStacks, {
            props: {
                state,
                printed: true,
                chrome: chromeWith(new Map([[stackTarget(region), { role: 'lit' }]]), false)
            }
        }).body

        expect(html).not.toContain(`data-open-stack="${region}"`)
        expect(html).toContain(`data-open-stack="${RegionIds[1]}"`)
        expect(html).toContain(`data-pick="${stackTarget(region)}"`)
    })

    it("R-1.2 A space and a marker on it are pressed by the space's name, never its id", () => {
        const host = new FeudumHost(3)
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const playerId = state.players[0].playerId
        state.spaces['space.sea.2'].serf = { playerId }
        const chrome = chromeWith(
            new Map([
                [spaceTarget('space.desert.4'), { role: 'lit' }],
                [spaceTarget('space.sea.1'), { role: 'lit' }],
                [markerTarget('space.sea.2', playerId, 'serf'), { role: 'lit' }]
            ])
        )
        const html = render(MapLayers, { props: { state, paintOf, chrome } }).body
        const names = [...html.matchAll(/role="button"[^>]*aria-label="([^"]*)"/g)].map(
            ([, name]) => name
        )

        expect(names).toEqual(expect.arrayContaining(['Desert 4', 'Sea 1', 'serf at Sea 2']))
        expect(names.filter((name) => name.includes('space.'))).toEqual([])
    })

    it('R-4.6 A guild is a target as well', () => {
        expect(guildTarget('monk')).toBe('guild:monk')
    })
})
