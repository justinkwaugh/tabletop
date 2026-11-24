// @vitest-environment node
import { setPawns } from '@tabletop/feudum/testing'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { HydratedFeudumGameState, type GuildId } from '@tabletop/feudum'
import { guildStandingsOf } from '$lib/model/guildStandings.js'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import GuildRail from './GuildRail.svelte'

/** One guild's rail beside its area: only what exists, each place named in words. */

const Names: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Bram', p3: 'Cleo' }

function paintOf(playerId: string) {
    return {
        fill: `seat-${playerId}`,
        ink: 'var(--feudum-text)',
        edge: 'var(--feudum-map-ink)',
        owner: `${Names[playerId]}'s`
    }
}

function railOf(guild: GuildId, spelled = false): string {
    const host = new FeudumHost(3)
    host.edit((state) => {
        setPawns(state, 'p1', ['farmer', 'farmer', 'farmer'])
        setPawns(state, 'p2', ['farmer'])
        setPawns(state, 'p3', ['farmer'])
        state.guilds.tracks.farmer = {
            master: { playerId: 'p1', reeve: true },
            journeyman: { playerId: 'p3', reeve: false }
        }
    })
    const state = new HydratedFeudumGameState(structuredClone(host.state))
    const row = guildStandingsOf(state, (id) => Names[id] ?? id).rows.find(
        (each) => each.guild === guild
    )
    if (!row) {
        throw new Error('No such guild')
    }
    return render(GuildRail, { props: { row, paintOf, spelled } }).body
}

/** The one button named so: its whole opening tag. */
function buttonNamed(markup: string, name: string): string {
    const tags = markup.match(/<button[^>]*>/g) ?? []
    const named = tags.filter((tag) => tag.includes(`aria-label="${name}"`))
    expect(named).toHaveLength(1)
    return named[0]
}

describe('a guild rail (R-4.5, R-4.7)', () => {
    it('R-4.5.1 shows its guild, the master boxed with stars and a reeve, then the places held and the placeless', () => {
        const markup = railOf('farmer')
        expect(markup).toContain('data-standing-row="farmer"')
        expect(markup).toContain('Farmer')
        const master = buttonNamed(markup, 'Farmer master: Ana, 3 stars, reeve')
        expect(master).toContain('data-lead')
        expect(master).toContain('data-reeve')
        expect(master).toContain('title="Farmer master: Ana, 3 stars, reeve"')
        expect(markup).toContain('data-standing-holder="p1"')
        expect(markup).toContain('seat-p1')
        buttonNamed(markup, 'Farmer journeyman: Cleo, 1 star')
        const other = buttonNamed(markup, 'Farmer, no place: Bram, 1 star, outranked')
        expect(other).toContain('title="Bram, 1 star, outranked"')
        expect(markup).not.toContain('data-standing-place="apprentice"')
        expect(markup).not.toContain('data-vacant')
        expect(markup).not.toContain('no master yet')
    })

    it('R-4.5 a guild with no master yet shows a solid empty marker outline, with no words, and nothing else', () => {
        const markup = railOf('monk')
        expect(markup).toContain('Monk')
        expect(markup).not.toContain('no master yet')
        expect(markup).toContain('data-no-master')
        expect(markup).not.toContain('stroke-dasharray')
        expect(markup).toContain('Monk master: vacant')
        expect(markup).not.toContain('<button')
    })

    it('R-4.5.1 spelled out in the desk strip: each holder named beside the stars, the lower places lettered, the placeless muted with their reason', () => {
        const markup = railOf('farmer', true)
        const master = buttonNamed(markup, 'Farmer master: Ana, 3 stars, reeve')
        expect(master).toContain('data-lead')
        expect(markup).toMatch(/data-standing-place="master"[\s\S]*?data-standing-name[^>]*>Ana</)
        expect(markup).toMatch(
            /data-standing-place="journeyman"[\s\S]*?data-standing-rank[^>]*>J<[\s\S]*?data-standing-name[^>]*>Cleo</
        )
        expect(markup).toMatch(
            /data-standing-other="p2"[\s\S]*?data-standing-name[^>]*>Bram<[\s\S]*?data-standing-reason[^>]*>outranked</
        )
        // Beside its area on a phone, the rail stays markers and stars, its words in the tooltips.
        expect(railOf('farmer')).not.toContain('data-standing-name')
    })

    it('R-4.5 spelled out, a guild with no master yet shows its empty outline and nothing else', () => {
        const markup = railOf('monk', true)
        expect(markup).toContain('data-no-master')
        expect(markup).toContain('Monk master: vacant')
        expect(markup).not.toContain('data-standing-name')
    })
})
