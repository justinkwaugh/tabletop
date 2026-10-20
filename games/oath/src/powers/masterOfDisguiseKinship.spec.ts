import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedTrade, Trade, TradeOption } from '../actions/trade.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { adviser } from '../testing/tables.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, player, site } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { expectFavorConserved } from '../testing/census.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathVisibility } from '../definition/runtime.js'
import { reliquarySlotId } from '../util/setup.js'
import { usableFavor } from '../util/favor.js'
import { payPowerCost, reasonCannotPayPowerCost } from '../util/powerCost.js'
import { cardPowers, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { OathRevision } from '../util/revision.js'
import type { ModifierUse } from '../util/modifiers.js'
import '../powers/index.js'

const VOW = 'denizen.nomad.vow-of-kinship'
const POVERTY = 'denizen.beast.vow-of-poverty'
const MASTER = 'denizen.arcane.master-of-disguise'
const SIGNAL = 'denizen.arcane.secret-signal'
const SMALL_FRIENDS = 'denizen.beast.small-friends'
const TENTS = 'denizen.nomad.tents'
const TOLL_ROADS = 'denizen.order.toll-roads'
const CURFEW = 'denizen.order.curfew'
const WOLVES = 'denizen.beast.wolves'
const ELDERS = 'denizen.nomad.elders'

const AT = OathRevision.EngineFixes19
const BEFORE = OathRevision.EngineFixes18

type Seat = Parameters<typeof testPlayer>[0]

interface Scene {
    dana?: Seat
    ann?: Seat
    /** Dana is the Chancellor, with Careless uncovered (R-6.6.2.a). */
    careless?: boolean
    /** Bea's Curfew lies at c1: Dana, an enemy, trades there only by giving Bea a favor. */
    curfew?: boolean
    orderBank?: number
    revision?: number
}

/**
 * Dana stands at c1 (Toll Roads) with Vow of Kinship and Master of Disguise and 2 favor on their
 * board; every bank holds 3. Ann holds Secret Signal faceup and a facedown adviser; Bea holds no
 * faceup adviser and rules c1. Wolves are at p1.
 */
function scene({ dana, ann, careless = false, curfew = false, orderBank = 3, revision = AT }: Scene = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                status: careless ? PlayerStatus.Chancellor : PlayerStatus.Exile,
                siteId: 'c1',
                supply: 4,
                favor: 2,
                secrets: 2,
                warbandsOnBoard: careless ? { [IMPERIAL_WARBANDS]: 3 } : { dana: 3 },
                advisers: [adviser(VOW), adviser(MASTER)],
                ...dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: careless ? PlayerStatus.Exile : PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 1,
                warbandsOnBoard: careless ? { ann: 2 } : { [IMPERIAL_WARBANDS]: 2 },
                advisers: [adviser(SIGNAL), adviser(TENTS, false)],
                ...ann
            }),
            testPlayer({ playerId: 'bea', color: Color.Yellow, siteId: 'h2', favor: 1, warbandsOnBoard: { bea: 2 } })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: careless ? 'dana' : 'ann',
            ...(careless ? { reliquary: [0, 1, 3].map((i) => ({ slotId: reliquarySlotId(i) })) } : {}),
            denizensBySite: { c1: curfew ? [TOLL_ROADS, CURFEW] : [TOLL_ROADS], c2: [], p1: [WOLVES], h1: [] },
            warbandsBySite: { c1: { bea: 1 } }
        }
    )
    s.favorBank[Suit.Order] = orderBank
    s.favorSupply += 3 - orderBank
    openTurn(s, 'dana')
    return s
}
type Board = ReturnType<typeof scene>

const disguisedAs = (playerId: string, ...more: ModifierUse[]) => [modifierUse(MASTER, [player(playerId)]), ...more]

function trade(
    s: Board,
    option: TradeOption,
    modifiers: ModifierUse[] = disguisedAs('ann'),
    { tolls, cardId = TOLL_ROADS }: { tolls?: string[]; cardId?: string } = {}
) {
    const action = new HydratedTrade(buildAction(Trade, { playerId: 'dana', cardId, option, modifiers, tolls }))
    expectFavorConserved(s, () => action.apply(s))
    return action
}

const reason = (s: Board, option: TradeOption, modifiers: ModifierUse[] = disguisedAs('ann'), tolls?: string[]) =>
    HydratedTrade.reasonCannotTrade(s, 'dana', TOLL_ROADS, option, modifiers, tolls)

const nomad = (s: Board) => s.favorBank[Suit.Nomad]
const onBoard = (s: Board, playerId = 'dana') => s.getPlayerState(playerId).favor

describe('Master of Disguise around the borrower’s own Vow of Kinship (its Q&A: "Yes")', () => {
    it('the favor a Trade for favor gains lands on the borrower’s board, and still counts with the bank', () => {
        const s = scene()
        const a = trade(s, TradeOption.ForFavor)
        expect(a.metadata?.favorGained).toBe(1)
        expect(s.favorBank[Suit.Order]).toBe(2)
        expect(onBoard(s)).toBe(3)
        expect(nomad(s)).toBe(3)
        // Nothing sweeps it into the bank afterwards: the Vow's holder uses board and bank alike.
        expect(usableFavor(s, 'dana')).toBe(6)
    })

    it('Careless’s favor and Secret Signal’s one more land on the board too', () => {
        const s = scene({ careless: true })
        const modifiers = disguisedAs('ann', modifierUse(SIGNAL))
        const plan = HydratedTrade.plan(s, 'dana', TOLL_ROADS, TradeOption.ForSecrets, modifiers)
        expect(plan.reason).toBeUndefined()
        expect(HydratedTrade.sideFavor(s, 'dana', TOLL_ROADS, TradeOption.ForSecrets, plan.active, modifiers)).toBe(2)
        const a = trade(s, TradeOption.ForSecrets, modifiers)
        expect(a.metadata?.modifierNotes).toEqual(['Careless: gained 1 favor', 'Secret Signal: gained 1 more favor'])
        // The two placed came off the board; the two gained came back to it.
        expect(s.tokensOn(TOLL_ROADS).favor).toBe(2)
        expect(s.favorBank[Suit.Order]).toBe(1)
        expect(onBoard(s)).toBe(2)
        expect(nomad(s)).toBe(3)
    })

    it('a Trade for secrets pays from the board alone: refused with the two favor only in the Nomad bank', () => {
        const poor = scene({ dana: { favor: 0 } })
        expect(nomad(poor)).toBe(3)
        expect(reason(poor, TradeOption.ForSecrets)).toMatch(/trading for secrets requires two favor to place/)
        // Undisguised, the Vow binds the Trade and the bank pays.
        expect(reason(poor, TradeOption.ForSecrets, [])).toBeUndefined()

        const s = scene()
        trade(s, TradeOption.ForSecrets)
        expect(s.tokensOn(TOLL_ROADS).favor).toBe(2)
        expect(onBoard(s)).toBe(0)
        expect(nomad(s)).toBe(3)
    })

    it('a toll paid in the same Trade comes off the board too: Curfew’s favor is totalled with the two placed', () => {
        const short = scene({ curfew: true })
        expect(reason(short, TradeOption.ForSecrets, disguisedAs('ann'), [CURFEW])).toMatch(/costs 3 favor in all, you hold 2/)

        const s = scene({ curfew: true, dana: { favor: 3 } })
        const a = trade(s, TradeOption.ForSecrets, disguisedAs('ann'), { tolls: [CURFEW] })
        expect(a.metadata?.tollsPaid).toEqual([`${CURFEW}: gave a favor to bea`])
        expect(onBoard(s)).toBe(0)
        expect(onBoard(s, 'bea')).toBe(2)
        expect(nomad(s)).toBe(3)
    })

    it('Vow of Poverty and Vow of Kinship both held by the borrower: neither binds the borrowed Trade', () => {
        const s = scene({ dana: { advisers: [adviser(POVERTY), adviser(VOW), adviser(MASTER)] } })
        expect(reason(s, TradeOption.ForFavor, [])).toMatch(/Vow of Poverty/)
        trade(s, TradeOption.ForFavor)
        expect(onBoard(s)).toBe(3)
        expect(nomad(s)).toBe(3)
    })

    it('a lender with no faceup adviser lends no Vow: the Trade gains to the board', () => {
        const s = scene()
        trade(s, TradeOption.ForFavor, disguisedAs('bea'))
        expect(onBoard(s)).toBe(3)
        expect(nomad(s)).toBe(3)
    })

    it('a borrowed Small Friends acts at its site, and the favor still lands on the board', () => {
        const s = scene({ ann: { advisers: [adviser(SMALL_FRIENDS)] } })
        const a = trade(s, TradeOption.ForFavor, disguisedAs('ann', modifierUse(SMALL_FRIENDS, [site('p1')])), { cardId: WOLVES })
        // Small Friends is Ann's one Beast adviser: 1 + 1 favor.
        expect(a.metadata?.favorGained).toBe(2)
        expect(s.favorBank[Suit.Beast]).toBe(1)
        expect(onBoard(s)).toBe(4)
        expect(nomad(s)).toBe(3)
    })

    it('an empty bank gives nothing, on the board or in the Nomad bank (R-9.3)', () => {
        const s = scene({ orderBank: 0 })
        const a = trade(s, TradeOption.ForFavor)
        expect(a.metadata?.favorGained).toBe(0)
        expect(onBoard(s)).toBe(2)
        expect(nomad(s)).toBe(3)
    })

    it('a Trade without Master of Disguise is unchanged: the holder’s Vow binds it', () => {
        const s = scene()
        trade(s, TradeOption.ForFavor, [])
        expect(onBoard(s)).toBe(2)
        expect(nomad(s)).toBe(4)
        const poor = scene({ dana: { favor: 0 } })
        trade(poor, TradeOption.ForSecrets, [])
        expect(poor.tokensOn(TOLL_ROADS).favor).toBe(2)
        expect(nomad(poor)).toBe(1)
    })
})

describe('Master of Disguise borrowing a lender’s Vow of Kinship', () => {
    const lent = (over: Scene = {}) =>
        scene({ ...over, dana: { favor: 0, advisers: [adviser(MASTER)], ...over.dana }, ann: { advisers: [adviser(VOW)], ...over.ann } })

    it('the Trade’s favor goes to the Nomad bank', () => {
        const s = lent()
        trade(s, TradeOption.ForFavor)
        expect(onBoard(s)).toBe(0)
        expect(nomad(s)).toBe(4)
    })

    it('a Trade for secrets may pay from the Nomad bank, and its toll too', () => {
        const s = lent()
        expect(reason(s, TradeOption.ForSecrets, [])).toMatch(/trading for secrets requires two favor to place/)
        trade(s, TradeOption.ForSecrets)
        expect(s.tokensOn(TOLL_ROADS).favor).toBe(2)
        expect(nomad(s)).toBe(1)

        const tolled = lent({ curfew: true })
        trade(tolled, TradeOption.ForSecrets, disguisedAs('ann'), { tolls: [CURFEW] })
        expect(nomad(tolled)).toBe(0)
        expect(onBoard(tolled, 'bea')).toBe(2)
        expect(onBoard(tolled)).toBe(0)
    })

    it('a lender holding both Vows: no Trade for favor, and a Trade for secrets pays from the bank with Careless’s favor withheld', () => {
        const s = lent({ careless: true, ann: { advisers: [adviser(POVERTY), adviser(VOW)] } })
        expect(reason(s, TradeOption.ForFavor)).toMatch(/Vow of Poverty/)
        const a = trade(s, TradeOption.ForSecrets)
        expect(a.metadata?.modifierNotes).toEqual(['Careless: you cannot gain favor from Trade (Vow of Poverty)'])
        expect(nomad(s)).toBe(1)
        expect(onBoard(s)).toBe(0)
        expect(s.favorBank[Suit.Order]).toBe(3)
    })
})

describe('a Trade modifier’s favor cost follows the lent Vow too', () => {
    // No Trade modifier prints a favor cost today (Master of Disguise's is a secret); Elders' two
    // placed favor stand in for one, through the same payment `payModifierCosts` makes.
    const elders = () => {
        const power = cardPowers(ELDERS)[powerIndexOf(ELDERS, PowerTiming.Action)]
        assertExists(power, 'Elders prints an Action')
        return power
    }

    it('judged and paid from the Nomad bank under the lender’s Vow, and from the board alone under the borrower’s own', () => {
        const lent = scene({ dana: { favor: 0, advisers: [adviser(MASTER)] }, ann: { advisers: [adviser(VOW)] } })
        expect(reasonCannotPayPowerCost(lent, 'dana', elders())).toMatch(/costs 2 favor, player has 0/)
        expect(reasonCannotPayPowerCost(lent, 'dana', elders(), undefined, 'ann')).toBeUndefined()
        expectFavorConserved(lent, () => payPowerCost(lent, 'dana', elders(), 'ann'))
        expect(lent.tokensOn(ELDERS).favor).toBe(2)
        expect(nomad(lent)).toBe(1)

        const own = scene({ dana: { favor: 0 } })
        expect(reasonCannotPayPowerCost(own, 'dana', elders())).toBeUndefined()
        expect(reasonCannotPayPowerCost(own, 'dana', elders(), undefined, 'ann')).toMatch(/costs 2 favor, player has 0/)
    })

    it('before revision 23 the lent set does not change it', () => {
        const lent = scene({ revision: BEFORE, dana: { favor: 0, advisers: [adviser(MASTER)] }, ann: { advisers: [adviser(VOW)] } })
        expect(reasonCannotPayPowerCost(lent, 'dana', elders(), undefined, 'ann')).toMatch(/costs 2 favor, player has 0/)
        const own = scene({ revision: BEFORE, dana: { favor: 0 } })
        expect(reasonCannotPayPowerCost(own, 'dana', elders(), undefined, 'ann')).toBeUndefined()
    })
})

describe('R-X.4 — before revision 23 the borrower’s own Vow binds the borrowed Trade', () => {
    it('its favor goes to the Nomad bank and a Trade for secrets pays from it', () => {
        const s = scene({ revision: BEFORE })
        trade(s, TradeOption.ForFavor)
        expect(onBoard(s)).toBe(2)
        expect(nomad(s)).toBe(4)
        const poor = scene({ revision: BEFORE, dana: { favor: 0 } })
        expect(reason(poor, TradeOption.ForSecrets)).toBeUndefined()
        trade(poor, TradeOption.ForSecrets)
        expect(nomad(poor)).toBe(1)
    })

    it('a lender’s Vow does not bind it', () => {
        const s = scene({ revision: BEFORE, dana: { favor: 0, advisers: [adviser(MASTER)] }, ann: { advisers: [adviser(VOW)] } })
        expect(reason(s, TradeOption.ForSecrets)).toMatch(/trading for secrets requires two favor to place/)
        trade(s, TradeOption.ForFavor)
        expect(onBoard(s)).toBe(1)
        expect(nomad(s)).toBe(3)
    })

    it('each revision’s disguised Trade replays unchanged', () => {
        for (const [revision, board, bank] of [
            [BEFORE, 2, 4],
            [AT, 3, 3]
        ]) {
            const before = scene({ revision }).dehydrate()
            const game = testGame(['dana', 'ann', 'bea'])
            const action = buildAction(Trade, { playerId: 'dana', cardId: TOLL_ROADS, option: TradeOption.ForFavor, modifiers: disguisedAs('ann') })
            const recorded = engine.runNext(action, structuredClone(before), game)
            expect(recorded.updatedState.players.find((p) => p.playerId === 'dana')?.favor).toBe(board)
            expect(recorded.updatedState.favorBank[Suit.Nomad]).toBe(bank)

            let replayed = structuredClone(before)
            for (const processed of recorded.processedActions)
                replayed = engine.run(structuredClone(processed), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

describe('Master of Disguise and Vow of Kinship on the borrower’s own view', () => {
    it('the Trade’s plan and its side favor read the same as on the whole state', () => {
        const view: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const scenes = [
            scene({ careless: true }),
            scene({ dana: { favor: 0 } }),
            scene({ careless: true, dana: { favor: 0, advisers: [adviser(MASTER)] }, ann: { advisers: [adviser(VOW), adviser(SIGNAL), adviser(TENTS, false)] } })
        ]
        for (const s of scenes) {
            const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
            for (const option of [TradeOption.ForFavor, TradeOption.ForSecrets]) {
                for (const modifiers of [disguisedAs('ann'), disguisedAs('ann', modifierUse(SIGNAL)), []]) {
                    const whole = HydratedTrade.plan(s, 'dana', TOLL_ROADS, option, modifiers)
                    const seen = HydratedTrade.plan(own, 'dana', TOLL_ROADS, option, modifiers)
                    expect(seen.reason).toEqual(whole.reason)
                    expect(seen.cost).toEqual(whole.cost)
                    if (whole.reason) continue
                    expect(HydratedTrade.sideFavor(own, 'dana', TOLL_ROADS, option, seen.active, modifiers)).toBe(
                        HydratedTrade.sideFavor(s, 'dana', TOLL_ROADS, option, whole.active, modifiers)
                    )
                }
            }
        }
    })
})
