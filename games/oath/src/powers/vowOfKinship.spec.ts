import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedRecover, RecoverTargetKind, Recover } from '../actions/recover.js'
import { HydratedUseRestPower, UseRestPower } from '../actions/useRestPower.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, IMPERIAL_COLOR, PlayerStatus, Suit } from '../model/oathEnums.js'
import { powersWithTiming, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { campaignRecords, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { payPowerCost, reasonCannotPayPowerCost } from '../util/powerCost.js'
import { continuousHooksOf } from '../util/continuous.js'
import { gainFavorFromBank, giveFavor, usableFavor } from '../util/favor.js'
import { expectFavorConserved } from '../testing/census.js'
import { hasEffect } from './registry.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, player } from '../testing/choices.js'

/** The nomad bank is usable favor but not on the holder's board, so a Take finds it empty. */
const VOW = 'denizen.nomad.vow-of-kinship'
const WRESTLERS = 'denizen.order.wrestlers'
const ELDERS = 'denizen.nomad.elders'
const FRIEND = 'denizen.hearth.charming-friend'
const TAX = 'denizen.order.royal-tax'
const POVERTY = 'denizen.beast.vow-of-poverty'
const STICKS = 'relic.dowsing-sticks'
const FILLER = 'denizen.hearth.storyteller'

const KIN = 'kin'
const FOE = 'foe'
const RED: Color = Color.Red
const BLUE: Color = Color.Blue

const faceup = (cardId: string) => ({ cardId, faceUp: true })

/** Every favor bank starts with three. */
function board(
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {},
    turn = KIN
) {
    const s = testState(
        [
            testPlayer({ playerId: KIN, color: Color.Red, siteId: 'c1', favor: 0, secrets: 2, supply: 6, advisers: [faceup(VOW)], warbandsOnBoard: { [RED]: 2 }, warbandsInPersonalBank: { [RED]: 8 }, ...over[KIN] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [BLUE]: 2 }, warbandsInPersonalBank: { [BLUE]: 8 }, ...over[FOE] })
        ],
        {
            denizensBySite: { c1: [WRESTLERS], c2: [] },
            warbandsBySite: { c1: { [RED]: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river' },
            ...state
        }
    )
    openTurn(s, turn)
    s.activePlayerIds = [turn]
    return s
}
type Board = ReturnType<typeof board>

const nomadBank = (s: Board) => s.favorBank[Suit.Nomad]
const boardFavor = (s: Board, playerId: string) => s.getPlayerState(playerId).favor

function searchPlay(s: Board, cardId: string, play: SearchPlay, faceUp: boolean | undefined, playerId = KIN) {
    s.getPlayerState(playerId).handIds = [cardId, FILLER]
    return new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId, keptCardId: cardId, discardOrder: [FILLER], play, faceUp })
    )
}
function trade(option: TradeOption, playerId = KIN) {
    return new HydratedTrade(buildAction(Trade, { playerId, cardId: WRESTLERS, option }))
}
function muster(playerId = KIN) {
    return new HydratedMuster(buildAction(Muster, { playerId, cardId: WRESTLERS }))
}

describe('Vow of Kinship — the record', () => {
    it('is registered: a continuous power that keeps its holder\'s favor in the nomad bank', () => {
        const power = powersWithTiming(VOW, PowerTiming.Continuous)[0]
        expect(hasEffect(power)).toBe(true)
        expect(continuousHooksOf(board(), KIN).map((h) => h.keepsFavorInBank)).toEqual([Suit.Nomad])
    })

    it('is an adviser card: a play to a site is refused', () => {
        const s = board({ [KIN]: { advisers: [], favor: 5 } })
        expect(() => searchPlay(s, VOW, SearchPlay.Site, undefined).apply(s)).toThrow(/adviser/i)
    })
})

describe('"Move all of your favor to the nomad bank."', () => {
    it('played faceup as an adviser, the board\'s favor goes to the nomad bank and nobody else\'s moves', () => {
        const s = board({ [KIN]: { advisers: [], favor: 5 } })
        expectFavorConserved(s, () => searchPlay(s, VOW, SearchPlay.Adviser, true).apply(s))
        expect(boardFavor(s, KIN)).toBe(0)
        expect(nomadBank(s)).toBe(8)
        expect(boardFavor(s, FOE)).toBe(4)
    })

    it('flipped faceup (R-6.1), the move happens at the flip and not before', () => {
        const s = board({ [KIN]: { advisers: [{ cardId: VOW, faceUp: false }], favor: 5 } })
        expect(usableFavor(s, KIN)).toBe(5)
        expect(nomadBank(s)).toBe(3)
        expectFavorConserved(s, () =>
            new HydratedPlayFacedownAdviser(
                buildAction(PlayFacedownAdviser, { playerId: KIN, cardId: VOW, play: SearchPlay.Adviser })
            ).apply(s)
        )
        expect(boardFavor(s, KIN)).toBe(0)
        expect(nomadBank(s)).toBe(8)
    })

    it('played facedown it has no power: nothing moves, and a gain stays on the board', () => {
        const s = board({ [KIN]: { advisers: [], favor: 5 } })
        searchPlay(s, VOW, SearchPlay.Adviser, false).apply(s)
        expect(boardFavor(s, KIN)).toBe(5)
        expect(nomadBank(s)).toBe(3)
        gainFavorFromBank(s, KIN, Suit.Order, 1)
        expect(boardFavor(s, KIN)).toBe(6)
    })
})

describe('"Any favor you gain or take is put in the nomad bank."', () => {
    it('a gain (R-10.10): Trade\'s favor leaves the order bank for the nomad bank', () => {
        const s = board()
        expectFavorConserved(s, () => trade(TradeOption.ForFavor).apply(s))
        expect(s.favorBank[Suit.Order]).toBe(2)
        expect(nomadBank(s)).toBe(4)
        expect(boardFavor(s, KIN)).toBe(0)
    })

    it('a gain from its own bank leaves the nomad bank as it was', () => {
        const s = board()
        expect(gainFavorFromBank(s, KIN, Suit.Nomad, 2)).toBe(2)
        expect(nomadBank(s)).toBe(3)
        expect(boardFavor(s, KIN)).toBe(0)
    })

    it('a take (R-10.26): Charming Friend\'s favor leaves their board for the nomad bank', () => {
        const s = board({ [KIN]: { advisers: [faceup(VOW), faceup(FRIEND)] } })
        expectFavorConserved(s, () => actionPowerUse(KIN, FRIEND, [player(FOE)]).apply(s))
        expect(boardFavor(s, FOE)).toBe(3)
        expect(nomadBank(s)).toBe(4)
        expect(boardFavor(s, KIN)).toBe(0)
    })

    it('favor given to the holder (R-10.11) is moved to the nomad bank too', () => {
        const s = board()
        expectFavorConserved(s, () => giveFavor(s, FOE, KIN, 2))
        expect(boardFavor(s, FOE)).toBe(2)
        expect(nomadBank(s)).toBe(5)
        expect(boardFavor(s, KIN)).toBe(0)
    })

    it('a gain by anyone else goes to their board', () => {
        const s = board({}, {}, FOE)
        expectFavorConserved(s, () => trade(TradeOption.ForFavor, FOE).apply(s))
        expect(boardFavor(s, FOE)).toBe(5)
        expect(nomadBank(s)).toBe(3)
    })
})

describe('"You can use favor in the nomad bank as if it is on your board."', () => {
    it('the whole nomad bank is the holder\'s to use', () => {
        const s = board({}, { favorBank: { ...board().favorBank, [Suit.Nomad]: 7 } })
        expect(usableFavor(s, KIN)).toBe(7)
    })

    it('Muster (R-5.2.1) places a favor from the bank on the card', () => {
        const s = board()
        expectFavorConserved(s, () => muster().apply(s))
        expect(nomadBank(s)).toBe(2)
        expect(s.tokensOn(WRESTLERS).favor).toBe(1)
        expect(boardFavor(s, KIN)).toBe(0)
    })

    it('Trade for secrets (R-5.3.2) places two favor from the bank on the card', () => {
        const s = board()
        expectFavorConserved(s, () => trade(TradeOption.ForSecrets).apply(s))
        expect(nomadBank(s)).toBe(1)
        expect(s.tokensOn(WRESTLERS).favor).toBe(2)
    })

    it('a placed cost (R-7.1.2): Elders\' two favor come from the bank', () => {
        const s = board({ [KIN]: { advisers: [faceup(VOW), faceup(ELDERS)] } })
        expectFavorConserved(s, () => actionPowerUse(KIN, ELDERS).apply(s))
        expect(nomadBank(s)).toBe(1)
        expect(s.tokensOn(ELDERS).favor).toBe(2)
        expect(s.getPlayerState(KIN).secrets).toBe(3)
    })

    it('a burned cost (R-10.4) leaves the bank for the shared supply', () => {
        const s = board({ [KIN]: { relicIds: [STICKS] } })
        const power = powersWithTiming(STICKS, PowerTiming.Action)[0]
        expectFavorConserved(s, () => payPowerCost(s, KIN, power))
        expect(nomadBank(s)).toBe(1)
        expect(s.favorSupply).toBe(20)
    })

    it('Recover (R-5.4.2) pays for the People\'s Favor out of the bank', () => {
        const s = board()
        expect(s.banners[Banner.PeoplesFavor].value).toBe(1)
        expectFavorConserved(s, () =>
            new HydratedRecover(
                buildAction(Recover, {
                    playerId: KIN,
                    target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
                    amountPaid: 2,
                    redistributeFrom: Suit.Order
                })
            ).apply(s)
        )
        expect(nomadBank(s)).toBe(1)
        expect(s.banners[Banner.PeoplesFavor].value).toBe(2)
        expect(s.banners[Banner.PeoplesFavor].holderPlayerId).toBe(KIN)
    })

    it('favor given away (R-10.11) leaves the bank for the other board', () => {
        const s = board()
        expectFavorConserved(s, () => giveFavor(s, KIN, FOE, 2))
        expect(nomadBank(s)).toBe(1)
        expect(boardFavor(s, FOE)).toBe(6)
    })

    it('is refused by what the bank holds: one favor cannot pay Elders, none cannot Muster', () => {
        const banks = board().favorBank
        const one = board({ [KIN]: { advisers: [faceup(VOW), faceup(ELDERS)] } }, { favorBank: { ...banks, [Suit.Nomad]: 1 } })
        const elders = powersWithTiming(ELDERS, PowerTiming.Action)[0]
        expect(reasonCannotPayPowerCost(one, KIN, elders)).toBe('costs 2 favor, player has 1')
        expect(() => actionPowerUse(KIN, ELDERS).apply(one)).toThrow(/costs 2 favor, player has 1/)

        const none = board({}, { favorBank: { ...banks, [Suit.Nomad]: 0 } })
        expect(() => muster().apply(none)).toThrow(/requires one favor to place on the card/)
    })
})

describe('it is not favor on the holder\'s board', () => {
    it('a Take finds an empty board: Charming Friend takes nothing from the holder', () => {
        const s = board({ [FOE]: { advisers: [faceup(FRIEND)] } }, {}, FOE)
        expectFavorConserved(s, () => actionPowerUse(FOE, FRIEND, [player(KIN)]).apply(s))
        expect(boardFavor(s, FOE)).toBe(4)
        expect(nomadBank(s)).toBe(3)
    })

    it('Royal Tax, played by the site\'s ruler, takes nothing from the holder standing there', () => {
        const s = board({}, { warbandsBySite: { c1: { [BLUE]: 2 } } }, FOE)
        expectFavorConserved(s, () => searchPlay(s, TAX, SearchPlay.Site, undefined, FOE).apply(s))
        expect(s.denizensBySite['c1']).toContain(TAX)
        expect(nomadBank(s)).toBe(3)
        // R-5.1.4.I — one order favor for the play, and nothing taxed.
        expect(boardFavor(s, FOE)).toBe(5)
    })

    it('R-5.5.7.III burns half of an empty board', () => {
        const s = testState(
            [
                testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1', warbandsOnBoard: { [BLUE]: 4 }, warbandsInPersonalBank: { [BLUE]: 8 } }),
                testPlayer({ playerId: KIN, color: Color.Red, siteId: 'c1', favor: 0, advisers: [faceup(VOW)], warbandsOnBoard: { [RED]: 3 }, warbandsInPersonalBank: { [RED]: 11 } }),
                testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', warbandsOnBoard: { [IMPERIAL_COLOR]: 6 }, warbandsInPersonalBank: { [IMPERIAL_COLOR]: 18 } })
            ],
            {
                chancellorPlayerId: 'chan',
                warbandsBySite: { c1: {} },
                campaign: {
                    attackerPlayerId: FOE,
                    defenderPlayerId: KIN,
                    nonImperialPlayerIds: [],
                    allyPlayerIds: [],
                    targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                    attackPool: 4,
                    defensePool: 1,
                    attackRoll: [],
                    defenseRoll: [],
                    defense: 2,
                    swords: 5,
                    defendingForce: [],
                    defendingBandits: 0,
                    ...campaignRecords(),
                    attackerVictorious: true
                }
            }
        )
        const action = new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, { playerId: FOE, placements: [], burnFavor: true })
        )
        expectFavorConserved(s, () => action.apply(s))
        expect(s.favorBank[Suit.Nomad]).toBe(3)
        expect(s.favorSupply).toBe(18)
    })

    it('Vow of Poverty\'s "if you have no favor" reads the board, so it takes its two', () => {
        const s = board({ [KIN]: { advisers: [faceup(VOW), faceup(POVERTY)] } })
        const powerIndex = powerIndexOf(POVERTY, PowerTiming.Rest)
        expectFavorConserved(s, () =>
            new HydratedUseRestPower(
                buildAction(UseRestPower, { playerId: KIN, cardId: POVERTY, powerIndex, choices: [{ kind: PowerChoiceKind.FavorBank, suit: Suit.Order }] })
            ).apply(s)
        )
        expect(s.favorBank[Suit.Order]).toBe(1)
        expect(nomadBank(s)).toBe(5)
    })
})

describe('"you" is the holder alone (R-10.28), and only while the vow is in play', () => {
    it('another player cannot use the bank', () => {
        const s = board({ [FOE]: { favor: 0 } }, {}, FOE)
        expect(usableFavor(s, FOE)).toBe(0)
        expect(() => muster(FOE).apply(s)).toThrow(/requires one favor to place on the card/)
    })

    it('an Imperial ally of the holder cannot use it either', () => {
        const s = board(
            {
                [KIN]: { status: PlayerStatus.Chancellor, color: Color.Purple, warbandsOnBoard: { [IMPERIAL_COLOR]: 2 }, warbandsInPersonalBank: { [IMPERIAL_COLOR]: 8 } },
                [FOE]: { status: PlayerStatus.Citizen, favor: 0 }
            },
            { chancellorPlayerId: KIN, warbandsBySite: { c1: { [IMPERIAL_COLOR]: 1 } } },
            FOE
        )
        expect(usableFavor(s, KIN)).toBe(3)
        expect(usableFavor(s, FOE)).toBe(0)
    })

    it('when the vow leaves play the favor stays in the bank and the use of it ends', () => {
        const s = board({ [KIN]: { advisers: [], favor: 4 } })
        searchPlay(s, VOW, SearchPlay.Adviser, true).apply(s)
        expect(usableFavor(s, KIN)).toBe(7)
        s.getPlayerState(KIN).setAdvisers([])
        expect(nomadBank(s)).toBe(7)
        expect(boardFavor(s, KIN)).toBe(0)
        expect(usableFavor(s, KIN)).toBe(0)
        expect(() => muster().apply(s)).toThrow(/requires one favor to place on the card/)
    })
})
