// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import {
    Goods,
    HydratedFeudumGameState,
    RoyalWrits,
    VesselTypes,
    writDeckCount
} from '@tabletop/feudum'
import { writName } from '$lib/model/writLabels.js'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import { PrintedColours } from '$lib/utils/boardGeometry.js'
import SupplyCard from './table/SupplyCard.svelte'

const folder = vi.hoisted(() => ({ files: {} as Record<string, string> }))
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
const colourPaintOf = (colour: string) => ({
    fill: `colour-${colour}`,
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: colour
})

async function table() {
    const { host } = await atPlayingCards(['explore'])
    return new HydratedFeudumGameState(structuredClone(host.state))
}

const card = (state: HydratedFeudumGameState, openWrits?: () => void) =>
    render(SupplyCard, {
        props: {
            state,
            paintOf,
            colourPaintOf,
            nameOf: (playerId: string) => `name-${playerId}`,
            ...(openWrits ? { openWrits } : {})
        }
    }).body

/** The markup of one labelled group, up to the next group. */
function group(html: string, name: string): string {
    const start = html.indexOf(`aria-label="${name}"`)
    expect(start, name).toBeGreaterThan(-1)
    const next = html.indexOf('role="group"', start + 1)
    return html.slice(start, next > -1 ? next : undefined)
}

const counted = (html: string, kind: string) =>
    html.match(new RegExp(`data-general-count="${kind}"[^>]*>([^<]*)<`))?.[1]

describe('Contract, Supply: the general supply in one grouped card (R-5.1, R-4.4, R-1.4.2)', () => {
    it('is one labelled card, its groups named in order', async () => {
        const html = card(await table())
        expect(html).toContain('aria-label="General supply"')
        const names = [
            'Writ deck',
            'Haversack',
            "King's seals",
            'Vessels',
            'Targets',
            'Shillings',
            'Location discs',
            'Influence markers',
            'Start player'
        ]
        const places = names.map((name) => html.indexOf(`role="group" aria-label="${name}"`))
        expect(places.every((place) => place > -1)).toBe(true)
        expect(places).toEqual([...places].sort((a, b) => a - b))
    })

    it('R-5.1 counts the deck from state', async () => {
        const state = await table()
        expect(counted(group(card(state), 'Writ deck'), 'deck')).toBe(`${writDeckCount(state)}`)
    })

    it('R-5.1, R-4.4.1, R-4.4.2 the deck is its count on one line: nothing of what lies in it', async () => {
        const state = await table()
        const [a] = state.players
        const [seenWrit, knownWrit] = RoyalWrits
        state.publicDeckWrits = [{ slot: 0, writId: seenWrit.id }]
        a.deckKnowledge = [{ slot: 1, writId: knownWrit.id }]
        const html = group(card(state), 'Writ deck')
        expect(html.match(/data-general-line="deck"/g)).toHaveLength(1)
        expect(counted(html, 'deck')).toBe(`${writDeckCount(state)}`)
        expect(html).not.toContain('data-general="deck-seen"')
        expect(html).not.toContain('data-general="deck-known"')
        expect(html).not.toContain('data-open-stack')
        for (const { id } of RoyalWrits) {
            expect(html).not.toContain(writName(id))
        }
    })

    it('R-5.1 opens the writ reference from the writ group, where the table offers it', async () => {
        const state = await table()
        expect(card(state)).not.toContain('data-open-writ-reference')
        const html = group(
            card(state, () => {}),
            'Writ deck'
        )
        expect(html).toMatch(/data-open-writ-reference[^>]*>Writ reference</)
    })

    it('R-5.4-H1 counts the haversack by good, each drawn and named', async () => {
        const state = await table()
        const html = group(card(state), 'Haversack')
        for (const good of Goods) {
            expect(counted(html, `haversack-${good}`)).toBe(`${state.supply.haversack[good]}`)
            expect(html).toContain(`>${good}<`)
        }
    })

    it('R-1.4.2, R-1.1-H1 counts the seals, vessels, targets, shillings and location discs', async () => {
        const state = await table()
        const html = card(state)
        expect(counted(group(html, "King's seals"), 'seals')).toBe(`${state.supply.sealPileCount}`)
        expect(counted(group(html, 'Targets'), 'targets')).toBe(`${state.supply.targets}`)
        expect(counted(group(html, 'Shillings'), 'shillings')).toBe(`${state.supply.shillings}`)
        const discs = group(html, 'Location discs')
        expect(counted(discs, 'discs')).toBe(`${state.supply.discs.length}`)
        expect(discs).toContain('location discs')
        for (const vessel of VesselTypes) {
            expect(counted(group(html, 'Vessels'), `vessels-${vessel}`)).toBe(
                `${state.supply.vessels[vessel]}`
            )
        }
    })

    it("R-1.4.2 counts influence by colour, a seat's from the colourizer and named by seat", async () => {
        const state = await table()
        const html = group(card(state), 'Influence markers')
        for (const colour of PrintedColours) {
            const held = state.supply.influence[colour]
            if (held !== undefined) {
                expect(counted(html, `influence-${colour}`)).toBe(`${held}`)
            } else {
                expect(html).not.toContain(`data-general-count="influence-${colour}"`)
            }
        }
        for (const { playerId } of state.players) {
            expect(html).toContain(`seat-${playerId}`)
            expect(html).toContain(`>name-${playerId}<`)
        }
        const dummy = state.guilds.knight.rows.find(({ playerId }) => !playerId)
        if (dummy) {
            expect(html).toContain(`colour-${dummy.colour}`)
        }
    })

    it("R-3.2 shows the start-player marker on the turn order's first seat", async () => {
        const state = await table()
        const html = group(card(state), 'Start player')
        expect(html).toContain(`data-start-player="${state.startingPlayerId}"`)
        expect(html).toContain(`seat-${state.startingPlayerId}`)
        expect(html).toContain(`>name-${state.startingPlayerId}<`)
    })
})
