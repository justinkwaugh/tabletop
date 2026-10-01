import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { OathGameInitializer } from '../definition/initializer.js'
import { PlayerStatus } from './oathEnums.js'
import { IMPERIAL_WARBANDS } from './warbandCounts.js'
import type { HydratedOathGameState } from './gameState.js'
import { CHANCELLOR, CITIZEN, EXILE, OTHER_EXILE, statusTable } from '../testing/tables.js'
import { testGame } from '../testing/game.js'
import { ownWarbandOwner, rulersOfSite, rulingWarbandOwners } from '../util/rule.js'
import { gainWarbandsToBoard, killWarbands, removeWarbandsFrom } from '../util/force.js'
import { becomeCitizen, becomeExile } from '../util/citizenship.js'
import { HydratedMuster } from '../actions/muster.js'

function table(): HydratedOathGameState {
    return statusTable(
        {
            warbandsBySite: {
                c1: { [IMPERIAL_WARBANDS]: 2 },
                c2: { [EXILE]: 2 },
                p1: { [OTHER_EXILE]: 1 }
            }
        },
        {
            [CHANCELLOR]: { warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } },
            [CITIZEN]: { warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 } },
            [EXILE]: { warbandsOnBoard: { [EXILE]: 3 } }
        }
    )
}

describe('whose warbands are whose (R-1.8, R-1.9, R-10.13)', () => {
    it('the Chancellor\'s own warbands are the Empire\'s; every other player\'s are keyed by their id', () => {
        const state = table()
        expect(ownWarbandOwner(state, CHANCELLOR)).toBe(IMPERIAL_WARBANDS)
        expect(ownWarbandOwner(state, CITIZEN)).toBe(CITIZEN)
        expect(ownWarbandOwner(state, EXILE)).toBe(EXILE)
    })

    it('an Imperial player rules with the Empire\'s warbands too, unless a Campaign suspends it (R-6.6.3, R-5.5.1.a)', () => {
        const state = table()
        expect(rulingWarbandOwners(state, CHANCELLOR)).toEqual([IMPERIAL_WARBANDS])
        expect(rulingWarbandOwners(state, CITIZEN)).toEqual([CITIZEN, IMPERIAL_WARBANDS])
        expect(rulingWarbandOwners(state, CITIZEN, { nonImperialPlayerIds: [CITIZEN] })).toEqual([CITIZEN])
        expect(rulingWarbandOwners(state, EXILE)).toEqual([EXILE])
    })

    it('the Empire\'s warbands bank with the Chancellor; an Exile\'s with that Exile; nobody else\'s exist', () => {
        const state = table()
        expect(state.warbandBankHolderOf(IMPERIAL_WARBANDS)).toBe(CHANCELLOR)
        expect(state.warbandBankHolderOf(EXILE)).toBe(EXILE)
        expect(() => state.warbandBankHolderOf('nobody')).toThrow('Player state for player nobody not found')
    })

    it('a Citizen musters the Empire\'s warbands; everyone else their own', () => {
        const state = table()
        expect(HydratedMuster.warbandOwnerFor(state, CITIZEN)).toBe(IMPERIAL_WARBANDS)
        expect(HydratedMuster.warbandOwnerFor(state, CHANCELLOR)).toBe(IMPERIAL_WARBANDS)
        expect(HydratedMuster.warbandOwnerFor(state, EXILE)).toBe(EXILE)
    })

    it('no player may take the Empire\'s key as an id', () => {
        const game = testGame([IMPERIAL_WARBANDS, 'p2'])
        expect(() =>
            new OathGameInitializer().initializeGameState(game, {
                id: 'state-1',
                gameId: game.id,
                activePlayerIds: [],
                actionCount: 0,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                winningPlayerIds: []
            })
        ).toThrow(/names the Empire's warbands/)
    })
})

describe('a player\'s colour is presentation only (DESIGN "Player relationships")', () => {
    function play(state: HydratedOathGameState): HydratedOathGameState {
        gainWarbandsToBoard(state, EXILE, 2)
        removeWarbandsFrom(state, { kind: 'site', siteId: 'c1' }, IMPERIAL_WARBANDS, 1)
        killWarbands(state, IMPERIAL_WARBANDS, 1)
        becomeExile(state, CITIZEN)
        becomeCitizen(state, EXILE)
        return state
    }

    function withoutColors(state: HydratedOathGameState) {
        const raw = state.dehydrate()
        return { ...raw, players: raw.players.map(({ color: _color, ...rest }) => rest) }
    }

    it('swapping every seat\'s colour changes no holding, rule or status', () => {
        const plain = play(table())
        const swapped = table()
        const shown = [Color.Yellow, Color.Red, Color.Purple, Color.Blue]
        swapped.players.forEach((player, index) => (player.color = shown[index]))
        play(swapped)

        expect(withoutColors(swapped)).toEqual(withoutColors(plain))
        for (const siteId of ['c1', 'c2', 'p1']) {
            expect(rulersOfSite(swapped, siteId)).toEqual(rulersOfSite(plain, siteId))
        }
        expect(swapped.getPlayerState(EXILE).status).toBe(PlayerStatus.Citizen)
        expect(swapped.getPlayerState(EXILE).warbandsOnBoard).toEqual({ [EXILE]: 0, [IMPERIAL_WARBANDS]: 5 })
        expect(swapped.warbandsBySite['c2']).toEqual({ [EXILE]: 0, [IMPERIAL_WARBANDS]: 2 })
    })
})
