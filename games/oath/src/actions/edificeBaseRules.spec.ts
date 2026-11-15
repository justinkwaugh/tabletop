import { describe, expect, it } from 'vitest'
import type { Visibility } from '@tabletop/common'
import { HydratedMuster, Muster } from './muster.js'
import { HydratedTrade, Trade, TradeOption } from './trade.js'
import { HydratedRecover } from './recover.js'
import { HydratedSelfExile } from './selfExile.js'
import { Banner, PlayerStatus, SearchPlay, Suit } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { buildAction } from '../testing/actions.js'
import { testBanners } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { engine } from '../testing/engine.js'
import { INN } from '../testing/cards.js'
import {
    ANCIENT_FORGE,
    DANA,
    HALL_OF_DEBATE,
    PLAINS_SLOT,
    RHYS,
    SPRAWLING_RAMPART,
    STONES_SLOT,
    WOLVES,
    edificeTable,
    placeEdifice
} from '../testing/edifices.js'
import { returnFavorFromCards, returnSecretsToBoard } from '../util/rest.js'
import { isLockedFor, reasonCannotMoveCardTo } from '../util/locked.js'
import { reasonCannotPlaceCard } from '../util/cardPlay.js'
import { SALT_THE_EARTH } from '../util/capacity.js'
import { banditRuledCardIds } from '../util/access.js'
import { banditsRuleSite } from '../util/rule.js'
import { discardDenizensAtSites, siteHasRoom } from '../powers/vocabulary.js'
import { placeChancellorWarbands, takesSetupGarrison } from '../util/setup.js'
import '../powers/index.js'

const BEAST_ADVISER = 'denizen.beast.rangers'
const NOMAD_CARD = 'denizen.nomad.tents'

function muster(playerId: string, cardId: string) {
    return new HydratedMuster(buildAction(Muster, { playerId, cardId }))
}

function trade(playerId: string, cardId: string, option: TradeOption) {
    return new HydratedTrade(buildAction(Trade, { playerId, cardId, option }))
}

describe('Muster with an edifice at the site (R-5.2.1, R-2.9)', () => {
    it('places its favor on an intact edifice', () => {
        const state = edificeTable()
        expect(HydratedMuster.legalCards(state, DANA)).toEqual([HALL_OF_DEBATE, WOLVES])
        muster(DANA, HALL_OF_DEBATE).apply(state)
        expect(state.tokensOn(HALL_OF_DEBATE)).toEqual({ favor: 1, secrets: 0 })
    })

    it('refuses a ruin in plain words', () => {
        const state = edificeTable({ [DANA]: { siteId: STONES_SLOT } })
        expect(HydratedMuster.reasonCannotMuster(state, DANA, ANCIENT_FORGE)).toMatch(
            /Broken Forge is a ruin, and a ruin cannot be used to Muster/
        )
        expect(HydratedMuster.legalCards(state, DANA)).toEqual([])
    })
})

describe('Trade with an edifice at the site (R-5.3.2, R-2.9)', () => {
    it('trades on an intact edifice from its suit’s bank, counting advisers of its suit', () => {
        const state = edificeTable({ [DANA]: { advisers: [{ cardId: INN, faceUp: true }] } })
        expect(HydratedTrade.matchingAdvisers(state, DANA, HALL_OF_DEBATE)).toBe(1)
        trade(DANA, HALL_OF_DEBATE, TradeOption.ForFavor).apply(state)
        expect(state.tokensOn(HALL_OF_DEBATE)).toEqual({ favor: 0, secrets: 1 })
        expect(state.getPlayerState(DANA).favor).toBe(6)
        expect(state.favorBank[Suit.Hearth]).toBe(1)
    })

    it('refuses a ruin in plain words, with either option, and no adviser matches it', () => {
        const state = edificeTable({
            [DANA]: { siteId: STONES_SLOT, advisers: [{ cardId: NOMAD_CARD, faceUp: true }] }
        })
        for (const option of [TradeOption.ForFavor, TradeOption.ForSecrets]) {
            expect(HydratedTrade.reasonCannotTrade(state, DANA, ANCIENT_FORGE, option)).toMatch(
                /Broken Forge is a ruin, and a ruin cannot be used to Trade/
            )
        }
        expect(HydratedTrade.legalCards(state, DANA)).not.toContain(ANCIENT_FORGE)
        expect(HydratedTrade.matchingAdvisers(state, DANA, ANCIENT_FORGE)).toBe(0)
    })
})

describe('Recover the Darkest Secret past an edifice (R-5.4.1)', () => {
    function holderAt(siteId: string, advisers: string[]) {
        return edificeTable(
            {
                [RHYS]: {
                    siteId,
                    advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
                }
            },
            { banners: testBanners({ [Banner.DarkestSecret]: RHYS }) }
        )
    }

    it('an intact edifice’s suit counts: a hearth edifice exposes a holder with only beast advisers', () => {
        const state = holderAt(PLAINS_SLOT, [BEAST_ADVISER])
        expect(HydratedRecover.darkestSecretIsExposed(state, RHYS)).toBe(true)
    })

    it('a ruin is ignored: with Hall of Debate ruined, Wolves matches and the holder is safe', () => {
        const state = holderAt(PLAINS_SLOT, [BEAST_ADVISER])
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        expect(HydratedRecover.darkestSecretIsExposed(state, RHYS)).toBe(false)
    })

    it('a site holding only a ruin counts as a site with no cards', () => {
        const state = holderAt(STONES_SLOT, [BEAST_ADVISER])
        expect(HydratedRecover.darkestSecretIsExposed(state, RHYS)).toBe(false)
    })
})

describe('Rest with tokens on edifices (R-4.3.1, R-4.3.2)', () => {
    it('favor on an intact edifice goes to its suit’s bank; favor on a ruin stays', () => {
        const state = edificeTable()
        state.addTokensOn(HALL_OF_DEBATE, { favor: 1 })
        state.addTokensOn(ANCIENT_FORGE, { favor: 2 })
        expect(returnFavorFromCards(state)).toBe(1)
        expect(state.favorBank[Suit.Hearth]).toBe(4)
        expect(state.favorBank[Suit.Nomad]).toBe(3)
        expect(state.tokensOn(ANCIENT_FORGE).favor).toBe(2)
    })

    it('secrets on either side return to the resting player’s board', () => {
        const state = edificeTable()
        state.addTokensOn(HALL_OF_DEBATE, { secrets: 1 })
        state.addTokensOn(ANCIENT_FORGE, { secrets: 2 })
        expect(returnSecretsToBoard(state, DANA)).toBe(3)
        expect(state.getPlayerState(DANA).secrets).toBe(5)
        expect(state.tokensOn(ANCIENT_FORGE).secrets).toBe(0)
    })
})

describe('Self-Exile counts secrets on edifices (R-6.8)', () => {
    it('on either side', () => {
        const state = edificeTable({ [RHYS]: { status: PlayerStatus.Citizen } })
        state.addTokensOn(HALL_OF_DEBATE, { secrets: 1 })
        state.addTokensOn(ANCIENT_FORGE, { secrets: 2 })
        state.addTokensOn(WOLVES, { secrets: 1 })
        expect(HydratedSelfExile.selfExileCost(state, RHYS).secretsOnCards).toBe(4)
    })
})

describe('Setup garrisons (R-1.12)', () => {
    it('a faceup site holding a denizen or an intact edifice takes one; a ruin alone does not', () => {
        const state = edificeTable({}, { denizensBySite: { [PLAINS_SLOT]: [], c2: [WOLVES] } })
        placeEdifice(state, 'h1', SPRAWLING_RAMPART)
        expect(takesSetupGarrison(state, PLAINS_SLOT)).toBe(true)
        expect(takesSetupGarrison(state, 'c2')).toBe(true)
        expect(takesSetupGarrison(state, 'h1')).toBe(true)
        expect(takesSetupGarrison(state, STONES_SLOT)).toBe(false)
        expect(takesSetupGarrison(state, 'h2')).toBe(false)
    })

    it('places 1 Imperial warband on each such site other than the top Cradle site', () => {
        const state = edificeTable({}, { denizensBySite: { c2: [WOLVES] }, warbandsBySite: {} })
        placeEdifice(state, 'h1', SPRAWLING_RAMPART)
        placeChancellorWarbands(state, state.getPlayerState(DANA))
        const imperial = (siteId: string) => state.warbandsBySite[siteId]?.[IMPERIAL_WARBANDS] ?? 0
        expect(imperial(PLAINS_SLOT)).toBe(2)
        expect(imperial('c2')).toBe(1)
        expect(imperial('h1')).toBe(1)
        expect(imperial(STONES_SLOT)).toBe(0)
        expect(state.getPlayerState(DANA).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(3)
        expect(state.getPlayerState(DANA).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(3)
    })
})

describe('An edifice fills a space and is locked (R-2.8.1, R-7.2.2)', () => {
    it('counts against the site’s capacity', () => {
        const state = edificeTable({ [DANA]: { siteId: STONES_SLOT } })
        expect(siteHasRoom(state, STONES_SLOT)).toBe(true)
        state.denizensBySite[STONES_SLOT] = [...state.denizensAt(STONES_SLOT), WOLVES]
        expect(siteHasRoom(state, STONES_SLOT)).toBe(false)
        expect(reasonCannotPlaceCard(state, DANA, NOMAD_CARD, SearchPlay.Site)).toMatch(
            /at its capacity of 2/
        )
    })

    it('is never discarded, moved or swapped by a power', () => {
        const state = edificeTable()
        expect(isLockedFor(state, DANA, HALL_OF_DEBATE)).toBe(true)
        expect(isLockedFor(state, DANA, ANCIENT_FORGE)).toBe(true)
        expect(reasonCannotMoveCardTo(state, DANA, HALL_OF_DEBATE, 'site')).toMatch(/locked/)
        const { discarded } = discardDenizensAtSites(
            state,
            DANA,
            [PLAINS_SLOT, STONES_SLOT],
            () => true,
            'denizen.discord.riots'
        )
        expect(discarded).toEqual([WOLVES])
        expect(state.denizensAt(PLAINS_SLOT)).toEqual([HALL_OF_DEBATE])
        expect(state.denizensAt(STONES_SLOT)).toEqual([ANCIENT_FORGE])
    })

    it('Salt the Earth cannot be played to a site holding one', () => {
        const state = edificeTable()
        expect(reasonCannotPlaceCard(state, DANA, SALT_THE_EARTH, SearchPlay.Site)).toBe(
            'Salt the Earth cannot be played to a site with any locked cards'
        )
    })

    it('R-10.21 — a site holding only a ruin and no warbands is ruled by the bandits, ruin and all', () => {
        const state = edificeTable()
        expect(banditsRuleSite(state, STONES_SLOT)).toBe(true)
        expect(banditRuledCardIds(state)).toContain(ANCIENT_FORGE)
    })
})

describe('Each seat’s own view offers what the server does (R-9.4)', () => {
    const game = { ...testGame([DANA, RHYS]), hotseat: false, protectedInformation: true as const }

    function ownView(state: HydratedOathGameState, playerId: string) {
        const view: Visibility.Perspective = { kind: 'player', playerId }
        return new HydratedOathGameState(served(state, view))
    }

    it.each([
        ['at the Plains', PLAINS_SLOT],
        ['at Standing Stones', STONES_SLOT]
    ])('Muster, Trade and Recover %s', (_, siteId) => {
        const state = edificeTable(
            {
                [DANA]: { siteId, advisers: [{ cardId: INN, faceUp: true }] },
                [RHYS]: {
                    siteId,
                    advisers: [
                        { cardId: BEAST_ADVISER, faceUp: true },
                        { cardId: NOMAD_CARD, faceUp: false }
                    ]
                }
            },
            { banners: testBanners({ [Banner.DarkestSecret]: RHYS }) }
        )
        const own = ownView(state, DANA)
        expect(HydratedMuster.legalCards(own, DANA)).toEqual(HydratedMuster.legalCards(state, DANA))
        expect(HydratedTrade.legalCards(own, DANA)).toEqual(HydratedTrade.legalCards(state, DANA))
        expect(HydratedRecover.darkestSecretIsExposed(own, RHYS)).toBe(
            HydratedRecover.darkestSecretIsExposed(state, RHYS)
        )
        for (const playerId of [DANA, RHYS]) {
            const seat: Visibility.Perspective = { kind: 'player', playerId }
            const data = state.dehydrate()
            expect(
                engine.getValidActionTypesForPlayer(game, served(data, seat), playerId, {
                    perspective: seat
                }),
                playerId
            ).toEqual(engine.getValidActionTypesForPlayer(game, data, playerId))
        }
    })
})
