import { setPawns } from '@tabletop/feudum/testing'
import { HydratedFeudumGameState, type GuildId } from '@tabletop/feudum'
import { describe, expect, it } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { guildStandingsOf, type GuildStandingsView } from './guildStandings.js'

/** The standings table's one derivation: each guild's track places, then who stars without one. */

const Names: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Bram', p3: 'Cleo', p4: 'Dov' }

function nameOf(playerId: string): string {
    return Names[playerId] ?? playerId
}

function standingsOn(
    numPlayers: number,
    arrange: (state: HydratedFeudumGameState) => void
): { state: HydratedFeudumGameState; view: GuildStandingsView } {
    const host = new FeudumHost(numPlayers)
    host.edit(arrange)
    const state = new HydratedFeudumGameState(structuredClone(host.state))
    return { state, view: guildStandingsOf(state, nameOf) }
}

function rowOf(view: GuildStandingsView, guild: GuildId) {
    const row = view.rows.find((candidate) => candidate.guild === guild)
    expect(row).toBeDefined()
    return row!
}

describe('Guild standings (R-4.5, R-4.7)', () => {
    it('R-1.3, R-4.5.3 one row per guild in ring order; three seats play no apprentice', () => {
        const { view } = standingsOn(3, () => undefined)

        expect(view.rows.map(({ guild }) => guild)).toEqual([
            'farmer',
            'merchant',
            'alchemist',
            'knight',
            'noble',
            'monk'
        ])
        expect(view.ranks).toEqual(['master', 'journeyman'])
        expect(rowOf(view, 'farmer').places.map(({ rank }) => rank)).toEqual([
            'master',
            'journeyman'
        ])
        expect(rowOf(view, 'farmer').places[0]).toMatchObject({
            holder: undefined,
            label: 'Farmer master: vacant'
        })
        expect(rowOf(view, 'farmer').others).toEqual([])
        expect(rowOf(view, 'farmer').othersLabel).toBe('Farmer, no place: none')
    })

    it('R-4.5.3 four seats play the apprentice: places read master, journeyman, apprentice', () => {
        const { state, view } = standingsOn(4, (edited) => {
            setPawns(edited, 'p1', ['merchant', 'merchant', 'merchant'])
            setPawns(edited, 'p2', ['merchant', 'merchant'])
            setPawns(edited, 'p3', ['merchant'])
            edited.guilds.tracks.merchant = {
                master: { playerId: 'p1', reeve: false },
                journeyman: { playerId: 'p2', reeve: false },
                apprentice: { playerId: 'p3', reeve: false }
            }
        })

        expect(view.ranks).toEqual(['master', 'journeyman', 'apprentice'])
        const places = rowOf(view, 'merchant').places
        expect(places.map(({ rank, holder }) => [rank, holder?.playerId])).toEqual([
            ['master', 'p1'],
            ['journeyman', 'p2'],
            ['apprentice', 'p3']
        ])
        expect(places[0].holder?.stars).toBe(state.statusStars('p1', 'merchant'))
        expect(places[0].label).toBe(
            `Merchant master: Ana, ${state.statusStars('p1', 'merchant')} stars`
        )
        expect(places[2].label).toBe('Merchant apprentice: Cleo, 1 star')
    })

    it('R-4.5-H1 a tie keeps the holder: the seat level on stars stands outranked, in seat order', () => {
        const { view } = standingsOn(3, (edited) => {
            setPawns(edited, 'p1', ['monk'])
            setPawns(edited, 'p2', ['monk'])
            setPawns(edited, 'p3', ['monk'])
            edited.guilds.tracks.monk = {
                master: { playerId: 'p3', reeve: false },
                journeyman: { playerId: 'p1', reeve: false }
            }
        })

        const monk = rowOf(view, 'monk')
        expect(monk.places.map(({ holder }) => holder?.playerId)).toEqual(['p3', 'p1'])
        expect(monk.others).toEqual([
            {
                playerId: 'p2',
                name: 'Bram',
                stars: 1,
                reason: 'outranked',
                label: 'Bram, 1 star, outranked'
            }
        ])
        expect(monk.othersLabel).toBe('Monk, no place: Bram, 1 star, outranked')
    })

    it('R-4.5.2 stars with every marker placed: "no marker", not "outranked"', () => {
        const { view } = standingsOn(3, (edited) => {
            setPawns(edited, 'p2', ['knight', 'knight'])
            const player = edited.getPlayerState('p2')
            edited.supply.influence[player.playerId] += player.influenceSupply
            player.influenceSupply = 0
        })

        const knight = rowOf(view, 'knight')
        expect(knight.places.every(({ holder }) => holder === undefined)).toBe(true)
        expect(knight.others).toEqual([
            {
                playerId: 'p2',
                name: 'Bram',
                stars: 2,
                reason: 'no marker',
                label: 'Bram, 2 stars, no marker'
            }
        ])
    })

    it('R-4.7 a reeve follows its holder: flagged, and said in the place', () => {
        const { view } = standingsOn(3, (edited) => {
            setPawns(edited, 'p1', ['farmer', 'farmer'])
            edited.guilds.tracks.farmer = { master: { playerId: 'p1', reeve: true } }
        })

        const [master, journeyman] = rowOf(view, 'farmer').places
        expect(master.holder).toEqual({ playerId: 'p1', name: 'Ana', stars: 2, reeve: true })
        expect(master.label).toBe('Farmer master: Ana, 2 stars, reeve')
        expect(journeyman.holder).toBeUndefined()
    })
})
