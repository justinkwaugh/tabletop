import { describe, expect, it } from 'vitest'
import { EXILE_CITIZEN_BASE_COST, HydratedExileCitizen, ExileCitizen } from './exileCitizen.js'
import { HydratedSelfExile, SelfExile } from './selfExile.js'
import { Banner, IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { Color } from '@tabletop/common'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { expectWarbandsConserved, expectWarbandTotalConserved } from '../testing/census.js'
import { MAX_SUPPLY, returnSecretsToBoard } from '../util/rest.js'
import { buildAction } from '../testing/actions.js'

function exileCitizen(playerId: string, citizenPlayerId: string) {
    return new HydratedExileCitizen(
        buildAction(ExileCitizen, { playerId, citizenPlayerId })
    )
}

function selfExile(playerId: string) {
    return new HydratedSelfExile(buildAction(SelfExile, { playerId }))
}

/** R-6.7 leaves the three purple at c1 alone. */
function table(citizenOverrides = {}, chancellorOverrides = {}) {
    return testState(
        [
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 10,
                relicIds: [GRAND_SCEPTER_ID],
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 17 },
                ...chancellorOverrides
            }),
            testPlayer({
                playerId: 'cit',
                color: Color.Red,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                favor: 2,
                supply: 1,
                warbandsOnBoard: { [IMPERIAL_COLOR]: 4 },
                warbandsInPersonalBank: { [Color.Red]: 14 },
                ...citizenOverrides
            })
        ],
        {
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [IMPERIAL_COLOR]: 3 } }
        }
    )
}

describe('Exiling a Citizen (R-6.7)', () => {
    it('gives five favor and flips them back to Exile', () => {
        const state = table()
        exileCitizen('chan', 'cit').apply(state)

        const cit = state.getPlayerState('cit')
        expect(cit.status).toBe(PlayerStatus.Exile)
        // R-10.11 — the favor is given, not burned, so it lands on their board.
        expect(state.getPlayerState('chan').favor).toBe(5)
        expect(cit.favor).toBe(2 + EXILE_CITIZEN_BASE_COST)
        expect(cit.supply).toBe(MAX_SUPPLY)
    })

    it('costs no Supply (R-6)', () => {
        const state = table()
        exileCitizen('chan', 'cit').apply(state)
        expect(state.getPlayerState('chan').supply).toBe(7)
        expect(state.getPlayerState('chan').supplySpentThisTurn).toBe(0)
    })

    it('recolours only the BOARD — the purple on the map stays the Empire’s', () => {
        // R-6.6.3 — purple sites belong to the whole Empire, not to the ex-Citizen.
        const state = table()
        const action = exileCitizen('chan', 'cit').apply(state)

        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({
            [IMPERIAL_COLOR]: 0,
            [Color.Red]: 4
        })
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 3 })
        void action
    })

    it('conserves warbands per colour as well as in total', () => {
        const state = table()
        expectWarbandTotalConserved(state, () => {
            expectWarbandsConserved(state, () => {
                exileCitizen('chan', 'cit').apply(state)
            })
        })
        // R-10.13 — purple goes home to the Chancellor; red comes from the ex-Citizen's bank.
        expect(state.getPlayerState('chan').warbandsInPersonalBank[IMPERIAL_COLOR]).toBe(21)
        expect(state.getPlayerState('cit').warbandsInPersonalBank[Color.Red]).toBe(10)
    })

    it('costs +1 for each of the Citizen’s two assets, and +2 for both', () => {
        const oathkeeper = table()
        oathkeeper.oathkeeperPlayerId = 'cit'
        expect(HydratedExileCitizen.exileCost(oathkeeper, 'chan', 'cit')).toBe(6)

        const banner = table()
        banner.banners[Banner.PeoplesFavor].holderPlayerId = 'cit'
        expect(HydratedExileCitizen.exileCost(banner, 'chan', 'cit')).toBe(6)

        const both = table()
        both.oathkeeperPlayerId = 'cit'
        both.banners[Banner.PeoplesFavor].holderPlayerId = 'cit'
        expect(HydratedExileCitizen.exileCost(both, 'chan', 'cit')).toBe(7)
    })

    it('costs −1 for each of the exiler’s two assets, and −2 for both', () => {
        const oathkeeper = table()
        oathkeeper.oathkeeperPlayerId = 'chan'
        expect(HydratedExileCitizen.exileCost(oathkeeper, 'chan', 'cit')).toBe(4)

        const both = table()
        both.oathkeeperPlayerId = 'chan'
        both.banners[Banner.PeoplesFavor].holderPlayerId = 'chan'
        expect(HydratedExileCitizen.exileCost(both, 'chan', 'cit')).toBe(3)
    })

    it('nets the two sides against each other', () => {
        const state = table()
        state.oathkeeperPlayerId = 'chan'
        state.banners[Banner.PeoplesFavor].holderPlayerId = 'cit'
        expect(HydratedExileCitizen.exileCost(state, 'chan', 'cit')).toBe(
            EXILE_CITIZEN_BASE_COST
        )

        const action = exileCitizen('chan', 'cit')
        action.apply(state)
        expect(action.metadata?.favorGiven).toBe(5)
        expect(action.metadata?.costModifier).toBe(0)
    })

    it('refuses without the Grand Scepter', () => {
        const state = table()
        state.getPlayerState('chan').relicIds = []
        expect(() => exileCitizen('chan', 'cit').apply(state)).toThrow(
            /requires the Grand Scepter/
        )
    })

    it('refuses a target who is not a Citizen, and refuses yourself', () => {
        const state = table()
        expect(() => exileCitizen('chan', 'chan').apply(state)).toThrow(
            /exiling yourself is R-6.8, not R-6.7/
        )
        state.getPlayerState('cit').status = PlayerStatus.Exile
        expect(() => exileCitizen('chan', 'cit').apply(state)).toThrow(
            /is a exile, not a Citizen/
        )
    })

    it('refuses when the exiler cannot pay the modified cost', () => {
        const state = table({}, { favor: 5 })
        state.oathkeeperPlayerId = 'cit'
        state.banners[Banner.PeoplesFavor].holderPlayerId = 'cit'
        expect(() => exileCitizen('chan', 'cit').apply(state)).toThrow(
            /costs 7 favor, player has 5/
        )
    })

    it('does NOT end the exiled Citizen’s Act Phase — unlike R-6.6.2 and R-6.8', () => {
        // R-9.1 — R-6.7 lists three effects, and ending the Act Phase is not one of them.
        const state = table()
        const action = exileCitizen('chan', 'cit')
        action.apply(state)
        expect(action.metadata).not.toHaveProperty('endsActPhase')
    })
})

describe('Self-Exiling (R-6.8)', () => {
    it('gives favor equal to secrets plus board warbands, and flips to Exile', () => {
        const state = table({ favor: 20, secrets: 2 })
        const action = selfExile('cit')
        action.apply(state)

        expect(action.metadata?.favorGiven).toBe(6)
        expect(state.getPlayerState('cit').status).toBe(PlayerStatus.Exile)
        expect(state.getPlayerState('cit').supply).toBe(MAX_SUPPLY)
        // R-10.11 — given to the Grand Scepter's holder.
        expect(state.getPlayerState('chan').favor).toBe(16)
        expect(state.getPlayerState('cit').favor).toBe(14)
    })

    it('counts facedown secrets on the board too (R-7.1.2.a)', () => {
        // R-7.1.2.a only stops a facedown secret paying a cost; this cost is paid in favor.
        const state = table({ favor: 20, secrets: 1, secretsFacedown: 2 })
        expect(HydratedSelfExile.selfExileCost(state, 'cit').secretsOnBoard).toBe(3)
    })

    it('counts secrets on EVERY denizen and relic — even ones you do not rule', () => {
        // R-9.1 — R-6.8's clause has no possessive, so nothing limits it to cards you rule.
        const state = table({ favor: 40, secrets: 0 })
        state.cardTokens['denizen.hearth.someone-elses'] = { favor: 0, secrets: 2 }
        state.cardTokens['relic.unnamed-3'] = { favor: 0, secrets: 1 }

        const cost = HydratedSelfExile.selfExileCost(state, 'cit')
        expect(cost.secretsOnCards).toBe(3)
        expect(cost.total).toBe(0 + 3 + 4)
    })

    it('does not count secrets on cards R-6.8 does not name', () => {
        // R-9.1 — R-6.8 names denizens and relics only; sites and Visions are out.
        const state = table({ favor: 40, secrets: 0 })
        state.cardTokens['site.the-tribunal'] = { favor: 0, secrets: 5 }
        state.cardTokens['vision.conquest'] = { favor: 0, secrets: 5 }
        expect(HydratedSelfExile.selfExileCost(state, 'cit').secretsOnCards).toBe(0)
    })

    it('counts warbands on the board of every colour', () => {
        const state = table({ favor: 40, warbandsOnBoard: { [IMPERIAL_COLOR]: 4, [Color.Red]: 2 } })
        expect(HydratedSelfExile.selfExileCost(state, 'cit').warbandsOnBoard).toBe(6)
    })

    it('cannot be used by the Grand Scepter’s holder (R-9.2)', () => {
        const state = table({ favor: 40, relicIds: [GRAND_SCEPTER_ID] })
        state.getPlayerState('chan').relicIds = []
        expect(() => selfExile('cit').apply(state)).toThrow(
            /cannot self-exile while you hold the Grand Scepter/
        )
    })

    it('refuses a player who is not a Citizen', () => {
        const state = table({ favor: 40, status: PlayerStatus.Exile })
        expect(() => selfExile('cit').apply(state)).toThrow(/only a Citizen can self-exile/)
    })

    it('refuses when the favor is short', () => {
        const state = table({ favor: 3, secrets: 2 })
        expect(() => selfExile('cit').apply(state)).toThrow(/costs 6 favor, player has 3/)
    })

    it('refuses when nobody holds the Grand Scepter', () => {
        const state = table({ favor: 40 })
        state.getPlayerState('chan').relicIds = []
        expect(() => selfExile('cit').apply(state)).toThrow(/nobody holds the Grand Scepter/)
    })

    it('recolours only the board, like R-6.7 and unlike R-6.6.2', () => {
        const state = table({ favor: 40 })
        expectWarbandTotalConserved(state, () => {
            expectWarbandsConserved(state, () => {
                selfExile('cit').apply(state)
            })
        })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({
            [IMPERIAL_COLOR]: 0,
            [Color.Red]: 4
        })
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 3 })
    })

    it('reports the end of the Act Phase — R-6.8 ends it, R-6.7 does not', () => {
        const state = table({ favor: 40 })
        state.turnManager.turnOrder = ['cit', 'chan']
        state.turnManager.startNextTurn(0)

        const action = selfExile('cit')
        action.apply(state)
        expect(action.metadata?.endsActPhase).toBe(true)
    })

    it('leaves purple on the board when the Citizen’s own colour has run out (R-9.3)', () => {
        const state = table({ favor: 40, warbandsInPersonalBank: { [Color.Red]: 1 } })
        const action = selfExile('cit')
        action.apply(state)

        expect(action.metadata?.recoloredCount).toBe(1)
        expect(action.metadata?.unreplacedCount).toBe(3)
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({
            [IMPERIAL_COLOR]: 3,
            [Color.Red]: 1
        })
    })

    it('is offered only to a Citizen who can pay and does not hold the Scepter', () => {
        expect(HydratedSelfExile.canDoSelfExile(table({ favor: 40 }), 'cit')).toBe(true)
        expect(HydratedSelfExile.canDoSelfExile(table({ favor: 0 }), 'cit')).toBe(false)
        expect(HydratedSelfExile.canDoSelfExile(table({ favor: 40 }), 'chan')).toBe(false)
    })
})

/** R-4.3.2's Rest sweeps every card secret to the resting player. */
describe('R-6.8 × R-4.3.2 — how long a secret stays on a card', () => {
    function citizenMidTurn() {
        return table({ secrets: 1, warbandsOnBoard: { [IMPERIAL_COLOR]: 3 } })
    }

    it('R-5.3.2 — trading a secret onto a card moves the cost, it does not raise it', () => {
        const before = citizenMidTurn()
        expect(HydratedSelfExile.selfExileCost(before, 'cit')).toEqual({
            total: 4,
            secretsOnBoard: 1,
            secretsOnCards: 0,
            warbandsOnBoard: 3
        })

        // Stands in for a Trade.
        const after = citizenMidTurn()
        after.getPlayerState('cit').secrets -= 1
        after.cardTokens['denizen.hearth.herald'] = { favor: 0, secrets: 1 }

        expect(HydratedSelfExile.selfExileCost(after, 'cit')).toEqual({
            total: 4,
            secretsOnBoard: 0,
            secretsOnCards: 1,
            warbandsOnBoard: 3
        })
    })

    it('the card secret is counted, not merely offset', () => {
        const state = citizenMidTurn()
        state.getPlayerState('cit').secrets -= 1
        state.cardTokens['denizen.hearth.herald'] = { favor: 0, secrets: 1 }
        state.getPlayerState('cit').favor = 10

        const action = selfExile('cit')
        action.apply(state)

        expect(action.metadata?.favorGiven).toBe(4)
        expect(action.metadata?.secretsOnCards).toBe(1)
        expect(action.metadata?.secretsOnBoard).toBe(0)
    })

    it('R-4.3.2 — the next Rest sweeps it off the card, so the term expires', () => {
        const state = citizenMidTurn()
        state.getPlayerState('cit').secrets -= 1
        state.cardTokens['denizen.hearth.herald'] = { favor: 0, secrets: 1 }
        expect(HydratedSelfExile.selfExileCost(state, 'cit').secretsOnCards).toBe(1)

        // R-4.3.2 has no possessive, so anyone's Rest sweeps it.
        returnSecretsToBoard(state, 'chan')

        expect(HydratedSelfExile.selfExileCost(state, 'cit').secretsOnCards).toBe(0)
        expect(state.getPlayerState('chan').secrets).toBe(1)
    })
})
