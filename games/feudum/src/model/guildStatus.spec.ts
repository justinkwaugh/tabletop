import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { GuildIds, type GuildId } from '../data/components.js'
import type { LocationKind } from '../data/discs.js'
import { makeFeudum, showLocation } from '../testing/improving.js'
import { canonicalOf, initialState } from '../testing/state.js'
import { conservationBreaks } from './conservation.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { recomputeRanks, rankOf, RankChange, statusStars } from './guildStatus.js'

/** R-1.4.1 Each player's markers, taken from the general supply so the count stays right. */
function dealtState(numPlayers = 4, markers = 7): HydratedFeudumGameState {
    const state = initialState(numPlayers)
    for (const player of state.players) {
        state.supply.influence[player.playerId] += player.influenceSupply - markers
        player.influenceSupply = markers
    }
    return state
}

function pawnsOn(state: HydratedFeudumGameState, playerId: string, guild: GuildId, count: number) {
    const pawns = state.getPlayerState(playerId).pawns
    pawns.forEach((pawn, index) => {
        if (index < count) {
            pawn.spaceId = 'space.forest.2'
            pawn.character = guild
        } else {
            delete pawn.spaceId
            delete pawn.character
        }
    })
}

function rule(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    playerId: string,
    kind: LocationKind,
    feudumGuild?: GuildId
) {
    const space = state.spaces[spaceId]
    if (feudumGuild) {
        makeFeudum(state, spaceId, feudumGuild)
    } else {
        showLocation(state, spaceId, kind)
    }
    space.ruler = { playerId, subject: false }
}

function holders(state: HydratedFeudumGameState, guild: GuildId) {
    const { master, journeyman, apprentice } = state.guilds.tracks[guild]
    return [master?.playerId, journeyman?.playerId, apprentice?.playerId]
}

describe('status stars', () => {
    it('R-4.5.1 +1 per pawn of the character on the board', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 2)
        expect(statusStars(state, 'p1', 'farmer')).toBe(2)
        expect(statusStars(state, 'p1', 'merchant')).toBe(0)
        expect(statusStars(state, 'p2', 'farmer')).toBe(0)
    })

    it('R-4.5.1 a pawn off the board gives none', () => {
        const state = dealtState()
        const pawn = state.getPlayerState('p1').pawns[0]
        pawn.character = 'farmer'
        expect(statusStars(state, 'p1', 'farmer')).toBe(0)
    })

    it('R-4.5.1 +3 per feudum of the icon ruled', () => {
        const state = dealtState()
        rule(state, 'space.sea.1', 'p1', 'feudum', 'noble')
        rule(state, 'space.sea.2', 'p1', 'feudum', 'noble')
        rule(state, 'space.sea.3', 'p1', 'feudum', 'monk')
        expect(statusStars(state, 'p1', 'noble')).toBe(6)
        expect(statusStars(state, 'p1', 'monk')).toBe(3)
        expect(statusStars(state, 'p1', 'knight')).toBe(0)
    })

    it('R-4.1.4 a serf or subject on a feudum gives no stars', () => {
        const state = dealtState()
        rule(state, 'space.sea.1', 'p1', 'feudum', 'noble')
        state.spaces['space.sea.1'].ruler = { playerId: 'p1', subject: true }
        state.spaces['space.sea.1'].serf = { playerId: 'p2' }
        expect(statusStars(state, 'p1', 'noble')).toBe(3)
        expect(statusStars(state, 'p2', 'noble')).toBe(0)
    })

    it('R-4.5.1 +1 per related location ruled once a pawn gives a primary star', () => {
        const state = dealtState()
        rule(state, 'space.sea.1', 'p1', 'farm')
        rule(state, 'space.sea.2', 'p1', 'farm')
        rule(state, 'space.sea.3', 'p1', 'town')
        expect(statusStars(state, 'p1', 'farmer')).toBe(0)
        pawnsOn(state, 'p1', 'farmer', 1)
        expect(statusStars(state, 'p1', 'farmer')).toBe(3)
    })

    it('R-4.5.1 a feudum is a primary star that lets related locations count', () => {
        const state = dealtState()
        rule(state, 'space.sea.1', 'p1', 'feudum', 'monk')
        rule(state, 'space.sea.2', 'p1', 'outpost')
        expect(statusStars(state, 'p1', 'monk')).toBe(4)
        expect(statusStars(state, 'p1', 'alchemist')).toBe(0)
    })

    it('R-4.5.1 R-1.2.4 a location counts in both guilds it is related to', () => {
        const state = dealtState()
        rule(state, 'space.sea.1', 'p1', 'town')
        pawnsOn(state, 'p1', 'merchant', 1)
        state.getPlayerState('p1').pawns[1].spaceId = 'space.forest.2'
        state.getPlayerState('p1').pawns[1].character = 'noble'
        expect(statusStars(state, 'p1', 'merchant')).toBe(2)
        expect(statusStars(state, 'p1', 'noble')).toBe(2)
    })

    it('R-4.5.1 monsters give none', () => {
        const state = dealtState()
        state.monsters.behemoth = { playerId: 'p1', spaceId: 'space.forest.2' }
        expect(starsInEveryGuild(state, 'p1')).toBe(0)
    })

    it('R-4.5.1 the state answers for itself', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'knight', 3)
        expect(state.statusStars('p1', 'knight')).toBe(3)
    })
})

function starsInEveryGuild(state: HydratedFeudumGameState, playerId: string): number {
    return GuildIds.reduce((sum, guild) => sum + statusStars(state, playerId, guild), 0)
}

describe('the recompute of ranks', () => {
    it('R-4.5.2 stars put a marker on the track at once, from supply', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        expect(holders(state, 'farmer')).toEqual(['p1', undefined, undefined])
        expect(state.getPlayerState('p1').influenceSupply).toBe(6)
    })

    it('R-1.4.9 seats taking one character fill master, journeyman, then apprentice', () => {
        const state = dealtState(5)
        for (const playerId of ['p1', 'p2', 'p3', 'p4']) {
            pawnsOn(state, playerId, 'monk', 1)
            recomputeRanks(state, playerId)
        }
        expect(holders(state, 'monk')).toEqual(['p1', 'p2', 'p3'])
        expect(state.getPlayerState('p4').influenceSupply).toBe(7)
    })

    it('R-4.5.3 the apprentice space is used only at 4 and 5 players', () => {
        for (const [players, third] of [
            [2, undefined],
            [3, undefined],
            [4, 'p3'],
            [5, 'p3']
        ] as const) {
            const state = dealtState(players)
            for (const playerId of ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, players)) {
                pawnsOn(state, playerId, 'monk', 1)
                recomputeRanks(state, playerId)
            }
            expect(state.guilds.tracks.monk.apprentice?.playerId).toBe(third)
            if (players === 3) {
                expect(state.getPlayerState('p3').influenceSupply).toBe(7)
            }
        }
    })

    it('R-4.5.3 more stars takes the space and the holder moves down one', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        pawnsOn(state, 'p2', 'farmer', 2)
        recomputeRanks(state, 'p2')
        expect(holders(state, 'farmer')).toEqual(['p2', 'p1', undefined])
    })

    it('R-4.5-H1 a holder keeps a space against an equal newcomer', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        pawnsOn(state, 'p2', 'farmer', 1)
        recomputeRanks(state, 'p2')
        expect(holders(state, 'farmer')).toEqual(['p1', 'p2', undefined])
    })

    it('R-4.5-H1 a holder keeps a space against an equal holder, even after both change', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 3)
        pawnsOn(state, 'p2', 'farmer', 2)
        recomputeRanks(state, 'p1')
        expect(holders(state, 'farmer')).toEqual(['p1', 'p2', undefined])
        pawnsOn(state, 'p1', 'farmer', 1)
        pawnsOn(state, 'p2', 'farmer', 1)
        recomputeRanks(state, 'p2')
        expect(holders(state, 'farmer')).toEqual(['p1', 'p2', undefined])
    })

    it('R-4.5-H1 ranks follow the new totals, not a bump per player', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 3)
        pawnsOn(state, 'p2', 'farmer', 2)
        pawnsOn(state, 'p3', 'farmer', 1)
        recomputeRanks(state, 'p1')
        pawnsOn(state, 'p1', 'farmer', 1)
        pawnsOn(state, 'p2', 'farmer', 2)
        pawnsOn(state, 'p3', 'farmer', 3)
        recomputeRanks(state, 'p1')
        expect(holders(state, 'farmer')).toEqual(['p3', 'p2', 'p1'])
    })

    it('R-4.5-H2 two non-holders tied: the acting player first', () => {
        const state = dealtState()
        pawnsOn(state, 'p2', 'noble', 1)
        pawnsOn(state, 'p4', 'noble', 1)
        recomputeRanks(state, 'p4')
        expect(holders(state, 'noble')).toEqual(['p4', 'p2', undefined])
    })

    it('R-4.5-H2 then the others in turn order from the acting player', () => {
        const state = dealtState()
        const [first, second, third, fourth] = state.turnManager.turnOrder
        for (const playerId of [first, second, third]) {
            pawnsOn(state, playerId, 'noble', 1)
        }
        recomputeRanks(state, fourth)
        expect(holders(state, 'noble')).toEqual([first, second, third])

        const next = dealtState()
        const [a, b, c, d] = next.turnManager.turnOrder
        for (const playerId of [a, b, d]) {
            pawnsOn(next, playerId, 'noble', 1)
        }
        recomputeRanks(next, c)
        expect(holders(next, 'noble')).toEqual([d, a, b])
    })

    it('R-4.5-H2 with no acting player, turn order from the starting player', () => {
        const state = dealtState()
        const [first, second] = state.turnManager.turnOrder
        pawnsOn(state, second, 'noble', 1)
        pawnsOn(state, first, 'noble', 1)
        recomputeRanks(state)
        expect(holders(state, 'noble')).toEqual([first, second, undefined])
    })

    it('R-4.5.3 losing all stars returns the marker; those below move up', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 2)
        pawnsOn(state, 'p2', 'farmer', 1)
        recomputeRanks(state, 'p1')
        pawnsOn(state, 'p1', 'farmer', 0)
        recomputeRanks(state, 'p1')
        expect(holders(state, 'farmer')).toEqual(['p2', undefined, undefined])
        expect(state.getPlayerState('p1').influenceSupply).toBe(7)
    })

    it('R-4.5.3 a holder pushed off the last space takes the marker back', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        pawnsOn(state, 'p2', 'farmer', 1)
        pawnsOn(state, 'p3', 'farmer', 1)
        recomputeRanks(state, 'p1')
        expect(state.getPlayerState('p3').influenceSupply).toBe(6)
        pawnsOn(state, 'p4', 'farmer', 2)
        recomputeRanks(state, 'p4')
        expect(holders(state, 'farmer')).toEqual(['p4', 'p1', 'p2'])
        expect(state.getPlayerState('p3').influenceSupply).toBe(7)
    })

    it('R-4.5.2 without a marker there is no membership and nobody is displaced', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        state.getPlayerState('p2').influenceSupply = 0
        pawnsOn(state, 'p2', 'farmer', 3)
        const changes = recomputeRanks(state, 'p2')
        expect(holders(state, 'farmer')).toEqual(['p1', undefined, undefined])
        expect(rankOf(state.guilds.tracks.farmer, 'p2')).toBeUndefined()
        expect(changes).toEqual([])
    })

    it('R-4.5.2 getting a marker places it at once while still qualifying', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        const p2 = state.getPlayerState('p2')
        p2.influenceSupply = 0
        pawnsOn(state, 'p2', 'farmer', 3)
        recomputeRanks(state, 'p2')
        p2.influenceSupply = 1
        recomputeRanks(state, 'p2')
        expect(holders(state, 'farmer')).toEqual(['p2', 'p1', undefined])
        expect(p2.influenceSupply).toBe(0)
    })

    it('R-4.5.2 a marker back from one guild can go on another in the same recompute', () => {
        const state = dealtState(4, 1)
        pawnsOn(state, 'p1', 'monk', 1)
        recomputeRanks(state, 'p1')
        expect(state.getPlayerState('p1').influenceSupply).toBe(0)
        pawnsOn(state, 'p1', 'farmer', 1)
        const changes = recomputeRanks(state, 'p1')
        expect(holders(state, 'monk')).toEqual([undefined, undefined, undefined])
        expect(holders(state, 'farmer')).toEqual(['p1', undefined, undefined])
        expect(state.getPlayerState('p1').influenceSupply).toBe(0)
        expect(changes).toEqual([
            { guildId: 'farmer', playerId: 'p1', to: 'master' },
            { guildId: 'monk', playerId: 'p1', from: 'master' }
        ])
    })

    it('R-4.5-H3 one marker and two guilds waiting: the first in ring order from the Farmer', () => {
        const state = dealtState(4, 1)
        const p1 = state.getPlayerState('p1')
        p1.pawns[0].spaceId = 'space.forest.2'
        p1.pawns[0].character = 'monk'
        p1.pawns[1].spaceId = 'space.forest.2'
        p1.pawns[1].character = 'merchant'
        recomputeRanks(state, 'p1')
        expect(holders(state, 'merchant')[0]).toBe('p1')
        expect(holders(state, 'monk')[0]).toBeUndefined()
        expect(p1.influenceSupply).toBe(0)
    })

    it('R-4.5.4 one call ranks every guild', () => {
        const state = dealtState()
        state.getPlayerState('p1').pawns[0].spaceId = 'space.forest.2'
        state.getPlayerState('p1').pawns[0].character = 'knight'
        state.getPlayerState('p2').pawns[0].spaceId = 'space.forest.2'
        state.getPlayerState('p2').pawns[0].character = 'noble'
        recomputeRanks(state, 'p1')
        expect(holders(state, 'knight')[0]).toBe('p1')
        expect(holders(state, 'noble')[0]).toBe('p2')
    })

    it('R-4.5.4 a location changing hands moves ranks through the ruled feudum', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'noble', 1)
        rule(state, 'space.sea.1', 'p2', 'feudum', 'noble')
        recomputeRanks(state, 'p2')
        expect(holders(state, 'noble')).toEqual(['p2', 'p1', undefined])
        rule(state, 'space.sea.1', 'p1', 'feudum', 'noble')
        recomputeRanks(state, 'p1')
        expect(holders(state, 'noble')).toEqual(['p1', undefined, undefined])
        expect(state.getPlayerState('p2').influenceSupply).toBe(7)
    })

    it('R-1.1 keeps every marker counted', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 2)
        pawnsOn(state, 'p2', 'farmer', 1)
        pawnsOn(state, 'p3', 'monk', 1)
        recomputeRanks(state, 'p1')
        pawnsOn(state, 'p1', 'farmer', 0)
        recomputeRanks(state, 'p1')
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })
})

describe('reeves through the recompute', () => {
    function withReeves() {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 3)
        pawnsOn(state, 'p2', 'farmer', 2)
        recomputeRanks(state, 'p1')
        const { master, journeyman } = state.guilds.tracks.farmer
        if (!master || !journeyman) {
            throw Error('both ranks should be held')
        }
        master.reeve = true
        journeyman.reeve = true
        return state
    }

    it('R-4.7 a reeve follows its marker from master to journeyman and back', () => {
        const state = withReeves()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        expect(state.guilds.tracks.farmer.master).toEqual({ playerId: 'p2', reeve: true })
        expect(state.guilds.tracks.farmer.journeyman).toEqual({ playerId: 'p1', reeve: true })
        pawnsOn(state, 'p1', 'farmer', 3)
        recomputeRanks(state, 'p1')
        expect(state.guilds.tracks.farmer.master).toEqual({ playerId: 'p1', reeve: true })
    })

    it('R-4.7 dropping to apprentice returns the reeve; the marker stays', () => {
        const state = withReeves()
        const before = state.freeDiscs('p2')
        pawnsOn(state, 'p3', 'farmer', 3)
        pawnsOn(state, 'p1', 'farmer', 3)
        recomputeRanks(state, 'p3')
        expect(state.guilds.tracks.farmer.apprentice).toEqual({ playerId: 'p2', reeve: false })
        expect(state.freeDiscs('p2')).toBe(before + 1)
    })

    it('R-4.7 losing every space returns the marker and the reeve', () => {
        const state = withReeves()
        const before = state.freeDiscs('p2')
        pawnsOn(state, 'p3', 'farmer', 3)
        pawnsOn(state, 'p4', 'farmer', 3)
        recomputeRanks(state, 'p3')
        expect(holders(state, 'farmer')).toEqual(['p1', 'p3', 'p4'])
        expect(state.getPlayerState('p2').influenceSupply).toBe(7)
        expect(state.freeDiscs('p2')).toBe(before + 1)
    })

    it('R-4.7 losing all stars returns the marker and the reeve', () => {
        const state = withReeves()
        const before = state.freeDiscs('p1')
        pawnsOn(state, 'p1', 'farmer', 0)
        const changes = recomputeRanks(state, 'p1')
        expect(rankOf(state.guilds.tracks.farmer, 'p1')).toBeUndefined()
        expect(state.getPlayerState('p1').influenceSupply).toBe(7)
        expect(state.freeDiscs('p1')).toBe(before + 1)
        expect(changes).toContainEqual({
            guildId: 'farmer',
            playerId: 'p1',
            from: 'master',
            reeveReturned: true
        })
    })
})

describe('the rank changes returned for the metadata', () => {
    it('R-4.5 lists each player whose rank moved', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        recomputeRanks(state, 'p1')
        pawnsOn(state, 'p2', 'farmer', 2)
        expect(recomputeRanks(state, 'p2')).toEqual([
            { guildId: 'farmer', playerId: 'p2', to: 'master' },
            { guildId: 'farmer', playerId: 'p1', from: 'master', to: 'journeyman' }
        ])
    })

    it('R-4.5.4 nothing moved, nothing returned, and the recompute settles', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        pawnsOn(state, 'p2', 'monk', 2)
        expect(recomputeRanks(state, 'p1')).toHaveLength(2)
        const tracks = structuredClone(state.guilds.tracks)
        expect(recomputeRanks(state, 'p1')).toEqual([])
        expect(state.guilds.tracks).toEqual(tracks)
    })

    it('R-4.5 the changes match their schema, for an Action to carry', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        const validator = Compile(RankChange)
        for (const change of recomputeRanks(state, 'p1')) {
            expect(validator.Check(change)).toBe(true)
        }
    })

    it('R-4.5.4 the state answers for itself', () => {
        const state = dealtState()
        pawnsOn(state, 'p1', 'farmer', 1)
        expect(state.recomputeRanks('p1')).toEqual([
            { guildId: 'farmer', playerId: 'p1', to: 'master' }
        ])
    })
})
