// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { HydratedFeudumGameState } from '@tabletop/feudum'
import { guildStandingsOf } from '$lib/model/guildStandings.js'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { setPawns } from '$lib/testing/guildTable.js'
import GuildStandings from './GuildStandings.svelte'

/** The standings table's markup: every cell named, the lead outlined, the placeless muted. */

const Names: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Bram', p3: 'Cleo', p4: 'Dov' }

function paintOf(playerId: string) {
    return {
        fill: 'var(--feudum-map-ink)',
        ink: 'var(--feudum-text)',
        edge: 'var(--feudum-map-ink)',
        owner: `${Names[playerId]}'s`
    }
}

function markupOn(numPlayers: number): string {
    const host = new FeudumHost(numPlayers)
    host.edit((state) => {
        setPawns(state, 'p1', ['farmer', 'farmer', 'farmer'])
        setPawns(state, 'p2', ['farmer'])
        state.guilds.tracks.farmer = { master: { playerId: 'p1', reeve: true } }
        if (numPlayers > 3) {
            setPawns(state, 'p4', ['monk'])
            const player = state.getPlayerState('p4')
            state.supply.influence[player.playerId] += player.influenceSupply
            player.influenceSupply = 0
        }
    })
    const state = new HydratedFeudumGameState(structuredClone(host.state))
    const view = guildStandingsOf(state, (id) => Names[id] ?? id)
    return render(GuildStandings, { props: { view, paintOf } }).body
}

/** The one button named so: its whole opening tag. */
function buttonNamed(markup: string, name: string): string {
    const tags = markup.match(/<button[^>]*>/g) ?? []
    const named = tags.filter((tag) => tag.includes(`aria-label="${name}"`))
    expect(named).toHaveLength(1)
    return named[0]
}

describe('Guild standings markup (R-4.5, R-4.7)', () => {
    it('R-1.3 a row per guild, its die face with no badge, and the places as columns', () => {
        const markup = markupOn(3)

        expect(markup).toContain('Guild standings')
        expect(markup.match(/data-standing-row=/g)).toHaveLength(6)
        expect(markup).not.toContain('data-badge')
        expect(markup).toMatch(/<abbr title="Master"[^>]*>Master<\/abbr>/)
        expect(markup).toMatch(/<abbr title="Journeyman"[^>]*>Journeym\.<\/abbr>/)
        expect(markup).not.toContain('Apprentice')
        expect(markup).toContain('Others')
        expect(markupOn(4)).toMatch(/<abbr title="Apprentice"[^>]*>Appr\.<\/abbr>/)
    })

    it('R-4.5, R-4.7 the master is outlined, the reeve a ringed dot, and every place named', () => {
        const markup = markupOn(3)

        const master = buttonNamed(markup, 'Farmer master: Ana, 3 stars, reeve')
        expect(master).toMatch(/class="place [^"]*\blead\b/)
        expect(master).toContain('title="Farmer master: Ana, 3 stars, reeve"')
        expect(master).toContain('data-reeve')
        expect(markup).toContain('class="reeve')
        expect(markup).toContain("Ana's influence marker")
        expect(markup).toContain('★3')
        expect(markup).toContain('Farmer journeyman: vacant')
        expect(markup).toContain('Merchant master: vacant')
        expect(markup).toContain('Merchant, no place: none')
        expect(markup).not.toContain('press a place for names')
        expect(markup).not.toContain('hover or press')
    })

    it('R-4.5.2 a seat with stars and no place stands muted under Others, its reason in the tooltip', () => {
        const markup = markupOn(4)

        const other = buttonNamed(markup, 'Farmer, no place: Bram, 1 star, outranked')
        expect(other).toMatch(/class="place [^"]*\bother\b/)
        expect(other).toContain('title="Bram, 1 star, outranked"')
        expect(other).toContain('data-reason="outranked"')
        expect(markup).toContain('data-reason="no marker"')
        expect(markup).toContain('Monk, no place: Dov, 1 star, no marker')
        expect(markup).not.toContain('press a place for names')
        expect(markup).not.toContain('hover or press')
    })
})
