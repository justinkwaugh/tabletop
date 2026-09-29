import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, OathType, PlayerStatus, Suit } from '../model/oathEnums.js'
import { testBanners, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { HydratedResolveWake, requiredFavorSteps, ResolveWake } from './resolveWake.js'
import { availablePeoplesFavorOptions } from '../util/wake.js'
import { HydratedEndActPhase, EndActPhase } from './endActPhase.js'
import { FINAL_ROUND, HydratedCompleteRest, CompleteRest } from './completeRest.js'
import type { OathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { buildAction } from '../testing/actions.js'

const CHANCELLOR = 'p1'
const EXILE = 'p2'

function table(
    overrides: Partial<OathGameState> = {},
    playerOverrides: Record<string, Partial<OathPlayerState>> = {}
) {
    const seats: OathPlayerState[] = [
        testPlayer({
            playerId: CHANCELLOR,
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: 'c1',
            warbandsInPersonalBank: { purple: 5 },
            ...playerOverrides[CHANCELLOR]
        }),
        testPlayer({
            playerId: EXILE,
            color: Color.Red,
            status: PlayerStatus.Exile,
            siteId: 'c2',
            warbandsInPersonalBank: { [Color.Red]: 4 },
            ...playerOverrides[EXILE]
        })
    ]
    const state = testState(seats, { chancellorPlayerId: CHANCELLOR, ...overrides })
    state.turnManager.turnOrder = [CHANCELLOR, EXILE]
    openTurn(state, CHANCELLOR)
    return state
}

function wakeAction(fields: Record<string, unknown>) {
    return new HydratedResolveWake(
        buildAction(ResolveWake, { playerId: CHANCELLOR, favorSteps: [], ...fields })
    )
}

describe('ResolveWake — R-4.1', () => {
    it('requires two favor steps on the Mob side (R-4.1.1.II)', () => {
        const state = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR }, 3) },
            { [CHANCELLOR]: { favor: 4 } }
        )
        state.banners[Banner.PeoplesFavor].mobSide = true
        expect(requiredFavorSteps(state, CHANCELLOR)).toBe(2)

        expect(() =>
            wakeAction({ playerId: CHANCELLOR, favorSteps: [{ kind: 'place' }] }).apply(state)
        ).toThrow(/still able/)

        wakeAction({
            playerId: CHANCELLOR,
            favorSteps: [{ kind: 'place' }, { kind: 'place' }]
        }).apply(state)
        expect(state.banners[Banner.PeoplesFavor].value).toBe(5)
        expect(state.getPlayerState(CHANCELLOR).favor).toBe(2)
    })

    it('validates each step against the board as it will be when that step runs', () => {
        // R-4.1.1-H1 — the banner holds two, so the second return would take it below its floor.
        const state = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR }, 2) },
            { [CHANCELLOR]: { favor: 0 } }
        )
        state.banners[Banner.PeoplesFavor].mobSide = true

        expect(
            HydratedResolveWake.reasonCannotResolveWake(state, CHANCELLOR, [
                { kind: 'return', toSuit: Suit.Discord },
                { kind: 'return', toSuit: Suit.Discord }
            ])
        ).toMatch(/never drops below/)
    })

    it('R-4.1.1-H1 — the banner never drops below one favor', () => {
        const state = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR }, 1) },
            { [CHANCELLOR]: { favor: 2 } }
        )
        expect(availablePeoplesFavorOptions(state, CHANCELLOR)).toEqual(['place'])
        expect(
            HydratedResolveWake.reasonCannotResolveWake(state, CHANCELLOR, [
                { kind: 'return', toSuit: Suit.Discord }
            ])
        ).toMatch(/never drops below/)
    })

    it('R-4.1.1-H1 — each Mob repetition excuses itself independently (R-9.2.a)', () => {
        // R-2.5.3's seized banner: at the floor with nothing to place, neither repetition is owed.
        const seized = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR }, 1) },
            { [CHANCELLOR]: { favor: 0 } }
        )
        seized.banners[Banner.PeoplesFavor].mobSide = true
        expect(requiredFavorSteps(seized, CHANCELLOR)).toBe(0)
        expect(
            HydratedResolveWake.reasonCannotResolveWake(seized, CHANCELLOR, [])
        ).toBeUndefined()

        const oneAble = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR }, 2) },
            { [CHANCELLOR]: { favor: 0 } }
        )
        oneAble.banners[Banner.PeoplesFavor].mobSide = true
        expect(requiredFavorSteps(oneAble, CHANCELLOR)).toBe(1)
        expect(
            HydratedResolveWake.reasonCannotResolveWake(oneAble, CHANCELLOR, [])
        ).toMatch(/still able/)

        wakeAction({
            playerId: CHANCELLOR,
            favorSteps: [{ kind: 'return', toSuit: Suit.Discord }]
        }).apply(oneAble)
        expect(oneAble.banners[Banner.PeoplesFavor].value).toBe(1)
    })

    it('flips to Mob and records it when the banner reaches six (R-4.1.1.III)', () => {
        const state = table(
            { banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR }, 5) },
            { [CHANCELLOR]: { favor: 2 } }
        )
        const action = wakeAction({ playerId: CHANCELLOR, favorSteps: [{ kind: 'place' }] })
        action.apply(state)

        expect(state.isOnMobSide(Banner.PeoplesFavor)).toBe(true)
        expect(action.metadata?.flippedToMob).toBe(true)
    })

    it('records the Usurper flip in metadata (R-4.1.3)', () => {
        const state = table({
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: EXILE,
            banners: testBanners({ [Banner.DarkestSecret]: EXILE })
        })
        openTurn(state, EXILE)

        const action = wakeAction({ playerId: EXILE })
        action.apply(state)

        expect(action.metadata?.flippedToUsurper).toBe(true)
        expect(action.metadata?.wonBy).toBeUndefined()
        expect(state.oathkeeperIsUsurper).toBe(true)
    })

    it('stops at R-4.1.2 when the Wake wins the game — R-4.1.3 does not run', () => {
        const state = table({
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: EXILE,
            oathkeeperIsUsurper: true,
            // Value 2: the return below must clear R-4.1.1-H1's floor of one.
            banners: testBanners({ [Banner.PeoplesFavor]: EXILE }, 2)
        })
        openTurn(state, EXILE)

        const action = wakeAction({
            playerId: EXILE,
            favorSteps: [{ kind: 'return', toSuit: Suit.Discord }],
            sitePowerTake: undefined
        })
        action.apply(state)

        expect(action.metadata?.wonBy).toBe('R-3.1')
        expect(state.winningPlayerIds).toEqual([EXILE])
    })

    it('takes one favor from an Opportunity site (R-4.1.4, R-11.1)', () => {
        const state = table(
            {
                siteCards: { c1: 'site.mine' },
                cardTokens: { 'site.mine': { favor: 2, secrets: 0 } }
            },
            { [CHANCELLOR]: { siteId: 'c1', favor: 0 } }
        )
        wakeAction({ playerId: CHANCELLOR, sitePowerTake: 'favor' }).apply(state)

        expect(state.getPlayerState(CHANCELLOR).favor).toBe(1)
        expect(state.cardTokens['site.mine'].favor).toBe(1)
    })

    it('refuses the site power away from an Opportunity site (R-4.1.4)', () => {
        const state = table({}, { [CHANCELLOR]: { siteId: 'c1' } })
        expect(() =>
            wakeAction({ playerId: CHANCELLOR, sitePowerTake: 'favor' }).apply(state)
        ).toThrow(/not at an Opportunity site/)
    })

    it('refuses a Wake taken out of turn', () => {
        const state = table()
        expect(HydratedResolveWake.reasonCannotResolveWake(state, EXILE, [])).toMatch(
            /it is p1’s turn/
        )
    })
})

describe('EndActPhase — R-4.2', () => {
    it('is always available to the acting player, and changes nothing', () => {
        const state = table()
        const before = JSON.stringify(state.dehydrate())

        expect(HydratedEndActPhase.canDoEndActPhase(state, CHANCELLOR)).toBe(true)
        new HydratedEndActPhase(
            buildAction(EndActPhase, { playerId: CHANCELLOR })
        ).apply(state)

        expect(JSON.stringify(state.dehydrate())).toBe(before)
    })

    it('refuses when it is not your turn', () => {
        const state = table()
        expect(HydratedEndActPhase.reasonCannotEndActPhase(state, EXILE)).toMatch(/it is p1’s turn/)
    })
})

describe('CompleteRest — R-4.3.5 and the round boundary (R-4)', () => {
    function restAction(playerId: string) {
        return new HydratedCompleteRest(
            buildAction(CompleteRest, { playerId })
        )
    }

    it('closes the round only for the last player in turn order (R-4)', () => {
        const state = table()
        expect(HydratedCompleteRest.isLastTurnOfRound(state, CHANCELLOR)).toBe(false)
        expect(HydratedCompleteRest.isLastTurnOfRound(state, EXILE)).toBe(true)
    })

    it('R-2.1.4 — ends the turn without advancing the round mid-round', () => {
        const state = table({ round: 3 })
        const action = restAction(CHANCELLOR)
        action.apply(state)

        expect(state.round).toBe(3)
        expect(action.metadata?.endedRound).toBeUndefined()
        expect(state.turnManager.turnCounts[CHANCELLOR]).toBe(1)
    })

    it('advances the round and records it when the last player rests', () => {
        const state = table({ round: 3 })
        openTurn(state, EXILE)
        const action = restAction(EXILE)
        action.apply(state)

        expect(state.round).toBe(4)
        expect(action.metadata?.endedRound).toBe(true)
        expect(action.metadata?.round).toBe(4)
        expect(action.metadata?.endDieRoll).toBeUndefined()
    })

    it('rolls the end die and marks itself un-undoable (R-3.3, R-X.3)', () => {
        const state = table({
            round: 5,
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: CHANCELLOR,
            banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR })
        })
        openTurn(state, EXILE)

        const action = restAction(EXILE)
        action.apply(state)

        expect(action.metadata?.endDieRoll).toBeGreaterThanOrEqual(1)
        expect(action.metadata?.endDieRoll).toBeLessThanOrEqual(6)
        expect(action.revealsInfo).toBe(true)
        expect(state.prng.invocations).toBe(1)
    })

    it('is undoable on a boundary that rolls nothing (R-X.3)', () => {
        const state = table({ round: 5, oathkeeperPlayerId: EXILE })
        openTurn(state, EXILE)

        const action = restAction(EXILE)
        action.apply(state)

        expect(action.revealsInfo).toBeFalsy()
        expect(state.prng.invocations).toBe(0)
    })

    it('resolves R-3.4 at the end of the final round, with no roll', () => {
        const state = table({
            round: FINAL_ROUND,
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: CHANCELLOR,
            banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR })
        })
        openTurn(state, EXILE)

        const action = restAction(EXILE)
        action.apply(state)

        expect(state.prng.invocations).toBe(0)
        expect(action.metadata?.wonBy).toBe('R-3.4.1')
        expect(state.winningPlayerIds).toEqual([CHANCELLOR])
        expect(state.round).toBe(FINAL_ROUND)
    })

    it('clears per-turn bookkeeping so it cannot leak (R-11.2)', () => {
        const state = table({}, { [CHANCELLOR]: { homelandUsedThisTurn: ['c1'] } })
        restAction(CHANCELLOR).apply(state)
        expect(state.getPlayerState(CHANCELLOR).homelandUsedThisTurn).toEqual([])
    })

    it('refuses when it is not your turn', () => {
        const state = table()
        expect(HydratedCompleteRest.reasonCannotCompleteRest(state, EXILE)).toMatch(
            /it is p1’s turn/
        )
    })
})
