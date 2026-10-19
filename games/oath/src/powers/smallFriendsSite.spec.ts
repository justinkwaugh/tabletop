import { describe, expect, it } from 'vitest'
import { Color, assertExists, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
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
import { resolveModifiers, usableModifiers } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const SMALL_FRIENDS = 'denizen.beast.small-friends'
const BIRDSONG = 'denizen.beast.birdsong'
const MASTER = 'denizen.arcane.master-of-disguise'
const MAP_LIBRARY = 'denizen.arcane.map-library'
const TOLL_ROADS = 'denizen.order.toll-roads'
const ORACLE = 'denizen.nomad.oracle'
const WOLVES = 'denizen.beast.wolves'
const OAK = 'denizen.beast.the-old-oak'
const TENTS = 'denizen.nomad.tents'
const INN = 'denizen.hearth.wayside-inn'

/**
 * Dana stands at c1 (Toll Roads, Oracle, Map Library) with Birdsong and Small Friends; Wolves are
 * at p1 and The Old Oak at h1, the two sites with a Beast card. Nobody rules a site, so no card is
 * in reach by rule. Ann holds a facedown adviser Dana cannot see.
 */
function scene(
    revision: OathRevision,
    over: { dana?: Parameters<typeof testPlayer>[0]; ann?: Parameters<typeof testPlayer>[0] } = {},
    denizensBySite: Record<string, string[]> = {}
): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 3,
                secrets: 2,
                advisers: [adviser(BIRDSONG), adviser(SMALL_FRIENDS)],
                ...over.dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                siteId: 'h2',
                favor: 2,
                secrets: 1,
                advisers: [adviser(TENTS, false)],
                ...over.ann
            })
        ],
        {
            oathRevision: revision,
            denizensBySite: {
                c1: [TOLL_ROADS, ORACLE, MAP_LIBRARY],
                c2: [],
                p1: [WOLVES],
                p2: [INN],
                h1: [OAK],
                ...denizensBySite
            }
        }
    )
    openTurn(s, 'dana')
    return s
}

const AT_19 = OathRevision.EngineFixes15
const AT_18 = OathRevision.EngineFixes14
const friendsAt = (siteId: string) => modifierUse(SMALL_FRIENDS, [site(siteId)])
const usable = (s: HydratedOathGameState, uses?: Parameters<typeof usableModifiers>[3]) =>
    usableModifiers(s, 'dana', ActionType.Trade, uses).map((p) => p.cardId)
const reason = (
    s: HydratedOathGameState,
    cardId: string,
    option: TradeOption,
    modifiers?: Parameters<typeof HydratedTrade.reasonCannotTrade>[4]
) => HydratedTrade.reasonCannotTrade(s, 'dana', cardId, option, modifiers)

function powerOf(cardId: string) {
    const power = cardPowers(cardId)[powerIndexOf(cardId, PowerTiming.Modifier)]
    assertExists(power, `${cardId} prints a modifier`)
    return power
}

describe('Small Friends acts at one picked Beast site (revision 19)', () => {
    it('asks for one faceup site with a Beast card', () => {
        const [choice, ...more] = offeredChoices(scene(AT_19), 'dana', powerOf(SMALL_FRIENDS))
        expect(more).toEqual([])
        expect(choice?.spec.min).toBe(1)
        expect(choice?.options).toEqual([site('p1'), site('h1')])
        expect(offeredChoices(scene(AT_18), 'dana', powerOf(SMALL_FRIENDS))).toEqual([])
    })

    it('trades only with a card at the picked site, not at the pawn’s own', () => {
        const s = scene(AT_19)
        expect(reason(s, WOLVES, TradeOption.ForFavor, [friendsAt('p1')])).toBeUndefined()
        expect(reason(s, TOLL_ROADS, TradeOption.ForFavor, [friendsAt('p1')])).toMatch(/not a denizen at your site/)
        expect(reason(s, OAK, TradeOption.ForFavor, [friendsAt('p1')])).toMatch(/not a denizen at your site/)
        expect(reason(s, OAK, TradeOption.ForFavor, [friendsAt('h1')])).toBeUndefined()
        expect(HydratedTrade.legalCards(s, 'dana', [friendsAt('h1')])).toEqual([OAK])
        // Picked at a site that is not a Beast site, or not picked at all: refused.
        expect(reason(s, INN, TradeOption.ForFavor, [friendsAt('p2')])).toBeDefined()
        expect(reason(s, WOLVES, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeDefined()
    })

    it('the Trade made: the card at the picked site takes the secret, the pawn stays', () => {
        const s = scene(AT_19)
        const trade = new HydratedTrade(
            buildAction(Trade, {
                playerId: 'dana',
                cardId: WOLVES,
                option: TradeOption.ForFavor,
                modifiers: [friendsAt('p1'), modifierUse(BIRDSONG)]
            })
        )
        trade.apply(s)
        expect(s.cardTokens[WOLVES]).toEqual({ favor: 0, secrets: 1 })
        // Law 5.3: 1, plus one for each Beast adviser (Birdsong, Small Friends); Birdsong spends no Supply.
        expect(trade.metadata?.favorGained).toBe(3)
        expect(trade.metadata?.supplySpent).toBe(0)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
    })

    it("lists the picked site's Trade modifiers and the player's own, not the pawn's site's", () => {
        const s = scene(AT_19)
        expect(usable(s, [friendsAt('h1')])).toEqual(expect.arrayContaining([BIRDSONG, SMALL_FRIENDS, OAK]))
        expect(usable(s, [friendsAt('h1')])).not.toContain(MAP_LIBRARY)
        expect(usable(s, [friendsAt('p1')])).not.toContain(OAK)
        expect(usable(s, [friendsAt('p1')])).not.toContain(MAP_LIBRARY)
        // Not declared: no far modifier; the pawn's own site's are in reach as ever.
        expect(usable(s)).toContain(MAP_LIBRARY)
        expect(usable(s)).not.toContain(OAK)
    })

    it("accepts the picked site's modifiers and the player's own, refuses the pawn's site's", () => {
        const s = scene(AT_19)
        const resolve = (uses: Parameters<typeof resolveModifiers>[3], cardId: string, tradeOption: TradeOption) =>
            resolveModifiers(s, 'dana', ActionType.Trade, uses, { cardId, tradeOption, actsAsAt: 'h1' })
        expect(resolve([friendsAt('h1'), modifierUse(OAK)], OAK, TradeOption.ForSecrets).reason).toBeUndefined()
        expect(resolve([friendsAt('h1'), modifierUse(BIRDSONG)], OAK, TradeOption.ForFavor).reason).toBeUndefined()
        expect(resolve([friendsAt('h1'), modifierUse(MAP_LIBRARY)], OAK, TradeOption.ForFavor).reason).toMatch(/neither rule/)
        // The Old Oak at h1 adds its secret: 2 Beast advisers, plus one.
        const t = scene(AT_19)
        const oak = new HydratedTrade(
            buildAction(Trade, {
                playerId: 'dana',
                cardId: OAK,
                option: TradeOption.ForSecrets,
                modifiers: [friendsAt('h1'), modifierUse(OAK)]
            })
        )
        oak.apply(t)
        expect(oak.metadata?.secretsGained).toBe(3)
        expect(t.getPlayerState('dana').secrets).toBe(5)
    })

    it('reaches no far site or modifier without a declared Small Friends', () => {
        const s = scene(AT_19)
        expect(reason(s, WOLVES, TradeOption.ForFavor)).toMatch(/not a denizen at your site/)
        expect(reason(s, WOLVES, TradeOption.ForFavor, [modifierUse(BIRDSONG)])).toMatch(/not a denizen at your site/)
        expect(
            resolveModifiers(s, 'dana', ActionType.Trade, [modifierUse(OAK)], { cardId: OAK, tradeOption: TradeOption.ForSecrets }).reason
        ).toMatch(/neither rule/)
    })

    it('Map Library at the picked site reads the pawn as there: its region is reached', () => {
        const at = (revision: OathRevision) =>
            scene(revision, {}, { c1: [TOLL_ROADS, ORACLE], p1: [WOLVES, MAP_LIBRARY] })
        const uses = [friendsAt('p1'), modifierUse(MAP_LIBRARY)]
        expect(reason(at(AT_19), INN, TradeOption.ForFavor, uses)).toBeUndefined()
        expect(reason(at(AT_19), TOLL_ROADS, TradeOption.ForFavor, uses)).toMatch(/not a denizen at your site/)
        // Without Small Friends' site the Map Library there still needs the pawn.
        expect(reason(at(AT_19), INN, TradeOption.ForFavor, [modifierUse(MAP_LIBRARY)])).toMatch(/neither rule/)
    })

    it("a borrowed Small Friends acts at its site; the borrower's own is one of their other advisers", () => {
        const s = scene(AT_19, {
            dana: { advisers: [adviser(MASTER), adviser(SMALL_FRIENDS)] },
            ann: { advisers: [adviser(BIRDSONG)] }
        })
        // Ann holds no Small Friends here: the borrower's own is refused, and reaches nothing.
        expect(usable(s, [friendsAt('h1')])).toContain(OAK)
        expect(usable(s, [modifierUse(MASTER, [player('ann')]), friendsAt('h1')])).not.toContain(OAK)
        expect(reason(s, WOLVES, TradeOption.ForFavor, [modifierUse(MASTER, [player('ann')]), friendsAt('p1')])).toMatch(
            /can't use your other advisers/
        )
        const lent = scene(AT_19, {
            dana: { advisers: [adviser(MASTER), adviser(BIRDSONG)] },
            ann: { advisers: [adviser(SMALL_FRIENDS)] }
        })
        expect(reason(lent, WOLVES, TradeOption.ForFavor, [modifierUse(MASTER, [player('ann')]), friendsAt('p1')])).toBeUndefined()
        expect(usable(lent, [modifierUse(MASTER, [player('ann')]), friendsAt('h1')])).toContain(OAK)
        expect(reason(lent, TOLL_ROADS, TradeOption.ForFavor, [modifierUse(MASTER, [player('ann')]), friendsAt('p1')])).toMatch(
            /not a denizen at your site/
        )
    })
})

describe("a Small Friends at the pawn's site names another Beast site (revision 19)", () => {
    // Dana stands at c1, where Small Friends lies beside Toll Roads and Map Library; she holds
    // only Birdsong. Small Friends is used from where the pawn stands (Law 7.4.1); the other cards
    // are judged as if the pawn were at the named site.
    const atPawn = (revision: OathRevision) =>
        scene(revision, { dana: { advisers: [adviser(BIRDSONG)] } }, { c1: [TOLL_ROADS, MAP_LIBRARY, SMALL_FRIENDS] })
    const resolve = (
        s: HydratedOathGameState,
        uses: Parameters<typeof resolveModifiers>[3],
        cardId: string,
        tradeOption: TradeOption
    ) => resolveModifiers(s, 'dana', ActionType.Trade, uses, { cardId, tradeOption, actsAsAt: 'h1' }).reason

    it('is accepted, and the Trade is made with a card at the named site', () => {
        const s = atPawn(AT_19)
        expect(resolve(s, [friendsAt('h1')], OAK, TradeOption.ForFavor)).toBeUndefined()
        expect(reason(s, OAK, TradeOption.ForFavor, [friendsAt('h1')])).toBeUndefined()
        expect(HydratedTrade.legalCards(s, 'dana', [friendsAt('h1')])).toEqual([OAK])
        expect(reason(s, TOLL_ROADS, TradeOption.ForFavor, [friendsAt('h1')])).toMatch(/not a denizen at your site/)
        const trade = new HydratedTrade(
            buildAction(Trade, {
                playerId: 'dana',
                cardId: OAK,
                option: TradeOption.ForFavor,
                modifiers: [friendsAt('h1'), modifierUse(BIRDSONG)]
            })
        )
        trade.apply(s)
        // Law 5.3: 1, plus one for the one Beast adviser (Birdsong).
        expect(trade.metadata?.favorGained).toBe(2)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
    })

    it("the named site's modifiers and the player's own are usable, the pawn's site's others are not", () => {
        const s = atPawn(AT_19)
        expect(resolve(s, [friendsAt('h1'), modifierUse(OAK)], OAK, TradeOption.ForSecrets)).toBeUndefined()
        expect(resolve(s, [friendsAt('h1'), modifierUse(BIRDSONG)], OAK, TradeOption.ForFavor)).toBeUndefined()
        expect(resolve(s, [friendsAt('h1'), modifierUse(MAP_LIBRARY)], OAK, TradeOption.ForFavor)).toMatch(/neither rule/)
        expect(usable(s, [friendsAt('h1')])).toEqual(expect.arrayContaining([SMALL_FRIENDS, BIRDSONG, OAK]))
        expect(usable(s, [friendsAt('h1')])).not.toContain(MAP_LIBRARY)
    })

    it('an adviser Small Friends is judged as before', () => {
        const s = scene(AT_19)
        expect(resolve(s, [friendsAt('h1')], OAK, TradeOption.ForFavor)).toBeUndefined()
        expect(resolve(s, [friendsAt('h1'), modifierUse(MAP_LIBRARY)], OAK, TradeOption.ForFavor)).toMatch(/neither rule/)
        expect(usable(s, [friendsAt('h1')])).toEqual(expect.arrayContaining([SMALL_FRIENDS, BIRDSONG, OAK]))
    })

    it('before revision 19 it names no site and reaches every Beast site, as recorded', () => {
        const s = atPawn(AT_18)
        expect(reason(s, OAK, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
        expect(reason(s, TOLL_ROADS, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
    })
})

describe('Small Friends with no faceup Beast site (revision 19)', () => {
    const noBeastSite = (revision: OathRevision, over: Parameters<typeof scene>[1] = {}) =>
        scene(revision, over, { p1: [], h1: [] })
    const declared = (s: HydratedOathGameState, uses: Parameters<typeof resolveModifiers>[3]) =>
        resolveModifiers(s, 'dana', ActionType.Trade, uses, { cardId: TOLL_ROADS, tradeOption: TradeOption.ForFavor }).reason

    it('is not listed, and its declaration is refused with the reason', () => {
        const s = noBeastSite(AT_19)
        expect(usable(s)).not.toContain(SMALL_FRIENDS)
        expect(usable(s)).toEqual(expect.arrayContaining([BIRDSONG, MAP_LIBRARY]))
        expect(declared(s, [modifierUse(SMALL_FRIENDS)])).toMatch(/no faceup site has a Beast card/)
        expect(declared(s, [friendsAt('p1')])).toMatch(/no faceup site has a Beast card/)
        expect(reason(s, TOLL_ROADS, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toMatch(
            /no faceup site has a Beast card/
        )
    })

    it('a borrowed Small Friends is not listed either', () => {
        const lent = noBeastSite(AT_19, {
            dana: { advisers: [adviser(MASTER), adviser(BIRDSONG)] },
            ann: { advisers: [adviser(SMALL_FRIENDS)] }
        })
        const disguised = [modifierUse(MASTER, [player('ann')])]
        expect(usable(lent, disguised)).not.toContain(SMALL_FRIENDS)
        expect(declared(lent, [...disguised, modifierUse(SMALL_FRIENDS)])).toMatch(/no faceup site has a Beast card/)
    })

    it('with one Beast site it is listed as ever', () => {
        const s = scene(AT_19, {}, { h1: [] })
        expect(usable(s)).toContain(SMALL_FRIENDS)
        expect(declared(s, [friendsAt('p1')])).toBeUndefined()
    })

    it('before revision 19 it is listed and declared as recorded', () => {
        const s = noBeastSite(AT_18)
        expect(usable(s)).toContain(SMALL_FRIENDS)
        expect(declared(s, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
        expect(reason(s, TOLL_ROADS, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
    })
})

describe('Small Friends before revision 19, as recorded', () => {
    it('reaches every Beast site undeclared and keeps the pawn’s own site', () => {
        const s = scene(AT_18)
        expect(usable(s)).toEqual(expect.arrayContaining([MAP_LIBRARY, OAK]))
        expect(reason(s, TOLL_ROADS, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
        expect(reason(s, WOLVES, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
        expect(reason(s, OAK, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS), modifierUse(MAP_LIBRARY)])).toBeUndefined()
        expect(reason(s, WOLVES, TradeOption.ForFavor, [friendsAt('p1')])).toBeDefined()
    })
})

describe('Small Friends on the player’s own view', () => {
    function ownView(s: HydratedOathGameState, playerId: string): HydratedOathGameState {
        const view: Visibility.Perspective = { kind: 'player', playerId }
        return OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
    }

    it('its site domain, the listed modifiers and the legal cards read the same as on the table', () => {
        const s = scene(AT_19)
        const own = ownView(s, 'dana')
        expect(offeredChoices(own, 'dana', powerOf(SMALL_FRIENDS))).toEqual(offeredChoices(s, 'dana', powerOf(SMALL_FRIENDS)))
        for (const siteId of ['p1', 'h1']) {
            expect(usable(own, [friendsAt(siteId)])).toEqual(usable(s, [friendsAt(siteId)]))
            expect(HydratedTrade.legalCards(own, 'dana', [friendsAt(siteId)])).toEqual(
                HydratedTrade.legalCards(s, 'dana', [friendsAt(siteId)])
            )
        }
        expect(HydratedTrade.legalCards(own, 'dana', [friendsAt('h1')])).toEqual([OAK])
    })

    it("a Small Friends at the pawn's site naming another site: the listing and legal cards read the same", () => {
        const s = scene(AT_19, { dana: { advisers: [adviser(BIRDSONG)] } }, { c1: [TOLL_ROADS, MAP_LIBRARY, SMALL_FRIENDS] })
        const own = ownView(s, 'dana')
        expect(usable(own, [friendsAt('h1')])).toEqual(usable(s, [friendsAt('h1')]))
        expect(usable(own, [friendsAt('h1')])).toContain(SMALL_FRIENDS)
        expect(HydratedTrade.legalCards(own, 'dana', [friendsAt('h1')])).toEqual([OAK])
    })

    it('with no faceup Beast site the listing reads the same as on the table', () => {
        const s = scene(AT_19, {}, { p1: [], h1: [] })
        const own = ownView(s, 'dana')
        expect(usable(own)).toEqual(usable(s))
        expect(usable(own)).not.toContain(SMALL_FRIENDS)
    })
})
