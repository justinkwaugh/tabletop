import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { ActionType } from '../definition/actions.js'
import { HydratedTrade, Trade, TradeOption } from '../actions/trade.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { adviser } from '../testing/tables.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, player, site } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { cardPowers, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { offeredChoices } from '../util/powerChoice.js'
import { resolveModifiers, usableModifiers, type ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const MASTER = 'denizen.arcane.master-of-disguise'
const BIRDSONG = 'denizen.beast.birdsong'
const RETURN = 'denizen.hearth.awaited-return'
const SIGNAL = 'denizen.arcane.secret-signal'
const MARRIAGE = 'denizen.hearth.marriage'
const SMALL_FRIENDS = 'denizen.beast.small-friends'
const POVERTY = 'denizen.beast.vow-of-poverty'
const TOLL_ROADS = 'denizen.order.toll-roads'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const ORACLE = 'denizen.nomad.oracle'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'

type Seat = Parameters<typeof testPlayer>[0]

/**
 * Dana stands at c1 (Toll Roads, Rowdy Pub, Oracle) with Birdsong, Awaited Return and Master of
 * Disguise; Ann, the Chancellor, holds Secret Signal and Marriage faceup and a facedown adviser;
 * Bea holds no faceup adviser. Wolves are at p1.
 */
function scene(over: { dana?: Seat; ann?: Seat } = {}, revision = OathRevision.EngineFixes15) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 3,
                secrets: 2,
                warbandsOnBoard: { dana: 3 },
                advisers: [adviser(BIRDSONG), adviser(RETURN), adviser(MASTER)],
                ...over.dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { ann: 2 },
                advisers: [adviser(SIGNAL), adviser(MARRIAGE), adviser(TENTS, false)],
                ...over.ann
            }),
            testPlayer({
                playerId: 'bea',
                color: Color.Yellow,
                siteId: 'h2',
                advisers: [adviser(TENTS, false)]
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: 'ann',
            denizensBySite: { c1: [TOLL_ROADS, ROWDY_PUB, ORACLE], c2: [], p1: [WOLVES], h1: [] }
        }
    )
    openTurn(s, 'dana')
    return s
}

const disguisedAs = (playerId: string, ...more: ModifierUse[]) => [
    modifierUse(MASTER, [player(playerId)]),
    ...more
]
const listed = (s: HydratedOathGameState, uses?: readonly ModifierUse[]) =>
    usableModifiers(s, 'dana', ActionType.Trade, uses).map((p) => p.cardId)

function modifierOf(cardId: string) {
    const power = cardPowers(cardId)[powerIndexOf(cardId, PowerTiming.Modifier)]
    assertExists(power, `${cardId} prints a modifier`)
    return power
}

describe('Master of Disguise lists the borrowed advisers', () => {
    it('before a player is picked, the player’s own advisers are listed; after, the picked player’s instead', () => {
        const s = scene()
        expect(listed(s, [modifierUse(MASTER)])).toEqual(
            expect.arrayContaining([BIRDSONG, RETURN, MASTER])
        )
        expect(listed(s, [modifierUse(MASTER)])).not.toContain(SIGNAL)
        expect(listed(s, disguisedAs('ann')).sort()).toEqual([MASTER, SIGNAL].sort())
    })

    it('the listing is what resolveModifiers accepts, card by card', () => {
        const s = scene()
        // Every Trade modifier either seat holds: each is judged on its own beside Master of Disguise.
        const sweep = [BIRDSONG, RETURN, SIGNAL]
        const particulars = {
            cardId: TOLL_ROADS,
            tradeOption: TradeOption.ForFavor,
            advisersOf: 'ann'
        }
        const listing = listed(s, disguisedAs('ann'))
        for (const cardId of sweep) {
            const accepted =
                resolveModifiers(
                    s,
                    'dana',
                    ActionType.Trade,
                    disguisedAs('ann', modifierUse(cardId)),
                    particulars
                ).reason === undefined
            expect(listing.includes(cardId), cardId).toBe(accepted)
        }
        expect(listing).toContain(SIGNAL)
        expect(listing).not.toContain(BIRDSONG)
        expect(listing).not.toContain(RETURN)
    })

    it('a borrowed card’s cost is the borrower’s: Awaited Return sacrifices from the borrower’s board', () => {
        const s = scene({
            ann: { advisers: [adviser(RETURN)] },
            dana: { advisers: [adviser(BIRDSONG), adviser(MASTER)] }
        })
        expect(listed(s, disguisedAs('ann'))).toContain(RETURN)
        const trade = new HydratedTrade(
            buildAction(Trade, {
                playerId: 'dana',
                cardId: TOLL_ROADS,
                option: TradeOption.ForFavor,
                modifiers: disguisedAs('ann', modifierUse(RETURN))
            })
        )
        trade.apply(s)
        expect(trade.metadata?.supplySpent).toBe(0)
        expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 2 })
        expect(s.getPlayerState('ann').warbandsOnBoard).toEqual({ ann: 2 })
        // Master of Disguise's own secret is placed on it, from Dana's supply: one there, one for the Trade.
        expect(s.cardTokens[MASTER]).toEqual({ favor: 0, secrets: 1 })
        expect(s.getPlayerState('dana').secrets).toBe(0)
        // With no warband on the borrower's board, the borrowed card's condition is not met.
        const empty = scene({
            ann: { advisers: [adviser(RETURN)] },
            dana: { advisers: [adviser(MASTER)], warbandsOnBoard: {} }
        })
        expect(
            HydratedTrade.reasonCannotTrade(
                empty,
                'dana',
                TOLL_ROADS,
                TradeOption.ForFavor,
                disguisedAs('ann', modifierUse(RETURN))
            )
        ).toMatch(/no warband on your board/)
    })

    it('the Trade counts the borrowed advisers: Marriage is two Hearth advisers, Secret Signal adds its favor', () => {
        const pub = scene()
        const a = new HydratedTrade(
            buildAction(Trade, {
                playerId: 'dana',
                cardId: ROWDY_PUB,
                option: TradeOption.ForFavor,
                modifiers: disguisedAs('ann')
            })
        )
        a.apply(pub)
        expect(a.metadata?.favorGained).toBe(3)
        const toll = scene()
        const b = new HydratedTrade(
            buildAction(Trade, {
                playerId: 'dana',
                cardId: TOLL_ROADS,
                option: TradeOption.ForFavor,
                modifiers: disguisedAs('ann', modifierUse(SIGNAL))
            })
        )
        b.apply(toll)
        expect(b.metadata?.favorGained).toBe(2)
    })

    it("Vow of Poverty is the borrower's own adviser, so it does not bind the borrowed Trade", () => {
        const s = scene({ dana: { advisers: [adviser(POVERTY), adviser(MASTER)] } })
        expect(listed(s, disguisedAs('ann'))).toContain(SIGNAL)
        expect(
            HydratedTrade.reasonCannotTrade(s, 'dana', TOLL_ROADS, TradeOption.ForFavor)
        ).toMatch(/Vow of Poverty/)
        expect(
            HydratedTrade.reasonCannotTrade(
                s,
                'dana',
                TOLL_ROADS,
                TradeOption.ForFavor,
                disguisedAs('ann', modifierUse(SIGNAL))
            )
        ).toBeUndefined()
    })

    it('a borrowed Small Friends is listed and acts at its site; the borrower’s own is not listed', () => {
        const s = scene({
            ann: { advisers: [adviser(SMALL_FRIENDS)] },
            dana: { advisers: [adviser(BIRDSONG), adviser(MASTER)] }
        })
        expect(listed(s, disguisedAs('ann'))).toContain(SMALL_FRIENDS)
        const own = scene({ dana: { advisers: [adviser(SMALL_FRIENDS), adviser(MASTER)] } })
        expect(listed(own)).toContain(SMALL_FRIENDS)
        expect(listed(own, disguisedAs('ann'))).not.toContain(SMALL_FRIENDS)
        expect(
            HydratedTrade.reasonCannotTrade(
                s,
                'dana',
                WOLVES,
                TradeOption.ForFavor,
                disguisedAs('ann', modifierUse(SMALL_FRIENDS, [site('p1')]))
            )
        ).toBeUndefined()
    })

    it('the Player choice names any other player: the Chancellor, or one with no faceup adviser', () => {
        const s = scene()
        const [choice] = offeredChoices(s, 'dana', modifierOf(MASTER))
        expect(choice?.options).toEqual([player('ann'), player('bea')])
        // Bea lends nothing: only Master of Disguise stays listed, and the Trade counts none of Dana's.
        expect(listed(s, disguisedAs('bea'))).toEqual([MASTER])
        const plan = HydratedTrade.plan(
            s,
            'dana',
            ROWDY_PUB,
            TradeOption.ForFavor,
            disguisedAs('bea')
        )
        expect(plan.reason).toBeUndefined()
        expect(HydratedTrade.matchingAdvisers(s, 'dana', ROWDY_PUB)).toBe(1)
        expect(HydratedTrade.matchingAdvisers(s, 'dana', ROWDY_PUB, plan.active)).toBe(0)
    })

    it('lists the same for a Citizen borrower as for an Exile', () => {
        const citizen = scene({ dana: { status: PlayerStatus.Citizen } })
        expect(listed(citizen, disguisedAs('ann')).sort()).toEqual([MASTER, SIGNAL].sort())
    })

    it('lists the same before revision 19: the listing changes no recorded Trade', () => {
        const s = scene({}, OathRevision.EngineFixes14)
        expect(listed(s, disguisedAs('ann')).sort()).toEqual([MASTER, SIGNAL].sort())
    })
})

describe('Master of Disguise on the player’s own view', () => {
    it("lists the picked player's faceup advisers without reading their facedown one", () => {
        const s = scene()
        const view: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const own = OathVisibility.state.guardForExecution(
            new HydratedOathGameState(served(s, view)),
            view
        )
        expect(listed(own, disguisedAs('ann')).sort()).toEqual([MASTER, SIGNAL].sort())
        expect(listed(own, disguisedAs('ann'))).toEqual(listed(s, disguisedAs('ann')))
        expect(listed(own, disguisedAs('bea'))).toEqual(listed(s, disguisedAs('bea')))
        expect(offeredChoices(own, 'dana', modifierOf(MASTER))).toEqual(
            offeredChoices(s, 'dana', modifierOf(MASTER))
        )
    })
})
