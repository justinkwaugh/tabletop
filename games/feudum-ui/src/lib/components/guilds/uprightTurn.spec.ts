// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { GuildIds, HydratedFeudumGameState, type GuildId } from '@tabletop/feudum'
import UprightGuild from '$lib/components/bench/UprightGuild.svelte'
import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
import EnlargedOnTable from '$lib/testing/EnlargedOnTable.svelte'
import { atPlayingCards } from '$lib/testing/turnTable.js'

const paint = {
    fill: '#336699',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
}
const paintOf = () => paint

/**
 * R-1.2.3 The print lies on its side on the board, its top toward the board's nearer edge: west for
 * Alchemist, Merchant and Farmer, east for Knight, Noble and Monk. A quarter turn clockwise stands a
 * west print upright; an east print takes a quarter turn counter-clockwise.
 */
const Upright: Record<GuildId, string> = {
    alchemist: 'rotate(90deg)',
    merchant: 'rotate(90deg)',
    farmer: 'rotate(90deg)',
    knight: 'rotate(-90deg)',
    noble: 'rotate(-90deg)',
    monk: 'rotate(-90deg)'
}

async function stateAtCards() {
    const { host } = await atPlayingCards(['explore'])
    return new HydratedFeudumGameState(structuredClone(host.state))
}

function transformOf(markup: string, attribute: string): string | undefined {
    const turned = markup.match(new RegExp(`<div[^>]*${attribute}[^>]*>`))?.[0]
    return turned?.match(/transform:\s*([^;"]+)/)?.[1]
}

describe('R-1.3 an upright guild area stands its print upright (contract: Card preview, The trade picker)', () => {
    it.each(GuildIds)('enlarged, the %s print is turned upright', async (guild) => {
        const state = await stateAtCards()
        const face: EnlargedFace = { kind: 'guild', guild, state, paintOf, colourPaintOf: paintOf }
        const markup = render(EnlargedOnTable, { props: { face, width: 640 } }).body
        expect(transformOf(markup, 'data-upright-turned')).toBe(
            `translate(-50%, -50%) ${Upright[guild]}`
        )
    })

    it.each(GuildIds)('in the trade picker, the %s print is turned upright', async (guild) => {
        const state = await stateAtCards()
        const markup = render(UprightGuild, {
            props: {
                area: { guild, placed: [], buttons: [], ghosts: [] },
                height: 310,
                state,
                paintOf,
                colourPaintOf: paintOf
            }
        }).body
        expect(transformOf(markup, 'data-upright-turned')).toBe(
            `translate(-50%, -50%) ${Upright[guild]}`
        )
    })
})
