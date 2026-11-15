import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert, assertExists, type Visibility } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    HydratedOathGameState,
    MachineState,
    OathRevision,
    OathVisibility,
    PlayerStatus,
    PowerChoiceKind,
    PowerTiming,
    TradeOption,
    isTrade,
    type ModifierUse,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { emptyPicks, withOptionPick } from './powerChoices.js'
import { tradeRows } from './tradeRows.js'
import type { OathGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const SMALL_FRIENDS = 'denizen.beast.small-friends'
const BIRDSONG = 'denizen.beast.birdsong'
const RETURN = 'denizen.hearth.awaited-return'
const MASTER = 'denizen.arcane.master-of-disguise'
const SIGNAL = 'denizen.arcane.secret-signal'
const MARRIAGE = 'denizen.hearth.marriage'
const MAP_LIBRARY = 'denizen.arcane.map-library'
const TOLL_ROADS = 'denizen.order.toll-roads'
const ORACLE = 'denizen.nomad.oracle'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const WOLVES = 'denizen.beast.wolves'
const OAK = 'denizen.beast.the-old-oak'
const INN = 'denizen.hearth.wayside-inn'
const TENTS = 'denizen.nomad.tents'

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })
const adviser = (cardId: string, faceUp = true) => ({ cardId, faceUp })
type Seat = Parameters<typeof testPlayer>[0]

/**
 * Dana at c1 (Toll Roads, Oracle, Map Library; the Inn at c2 in the region) with Birdsong and
 * Small Friends; Wolves at p1 and The Old Oak at h1, the Beast sites.
 */
function friends(
    over: Partial<Seat> = {},
    denizens: Record<string, string[]> = {},
    oathRevision: number = CURRENT_OATH_REVISION
) {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 3,
                secrets: 2,
                advisers: [adviser(BIRDSONG), adviser(SMALL_FRIENDS)],
                ...over
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                siteId: 'h2',
                advisers: [adviser(TENTS, false)]
            })
        ],
        {
            oathRevision,
            machineState: MachineState.ActPhase,
            denizensBySite: {
                c1: [TOLL_ROADS, ORACLE, MAP_LIBRARY],
                c2: [INN],
                p1: [WOLVES],
                h1: [OAK],
                ...denizens
            }
        }
    )
    openTurn(state, 'Dana')
    return state
}

/**
 * Dana at c1 (Toll Roads, Rowdy Pub, Oracle) with Birdsong, Awaited Return and Master of Disguise;
 * Ann, the Chancellor, holds Secret Signal, Marriage and a facedown adviser.
 */
function disguise() {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 3,
                secrets: 2,
                warbandsOnBoard: { Dana: 3 },
                advisers: [adviser(BIRDSONG), adviser(RETURN), adviser(MASTER)]
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h2',
                advisers: [adviser(SIGNAL), adviser(MARRIAGE), adviser(TENTS, false)]
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Ann',
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [TOLL_ROADS, ROWDY_PUB, ORACLE], c2: [], p1: [WOLVES], h1: [] }
        }
    )
    openTurn(state, 'Dana')
    return state
}

async function sessionAt(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    return { session, sent }
}

const listed = (session: OathGameSession) => session.modifiers.listed.map((power) => power.cardId)
const rows = (session: OathGameSession) => session.tradeRows.map((row) => row.cardId)
const favorFor = (session: OathGameSession, cardId: string) =>
    session.tradeRows
        .find((row) => row.cardId === cardId)
        ?.choices.find((c) => c.option === TradeOption.ForFavor)?.gain

function listedCard(session: OathGameSession, cardId: string) {
    const power = session.modifiers.listed.find((p) => p.cardId === cardId)
    assertExists(power, `${cardId} is listed`)
    return power
}

function smallFriends(session: OathGameSession) {
    const power = session.modifiers.options.find((p) => p.cardId === SMALL_FRIENDS)
    assertExists(power, 'Small Friends is usable')
    return power
}

/** Small Friends' site, picked by its button's index. */
function pickSite(session: OathGameSession, index: number) {
    const [legal] = session.modifiers.choicesOf(smallFriends(session))
    assert(legal, 'Small Friends asks for a site')
    session.modifiers.setPicks(use(SMALL_FRIENDS), withOptionPick(emptyPicks(), legal, 0, index))
}

describe('Small Friends in the Trade menu: one picked Beast site', () => {
    it('with no faceup site holding a Beast card it has nothing to pick: in neither the Trade menu nor Use a power', async () => {
        const { session } = await sessionAt(friends({}, { p1: [], h1: [] }))
        expect(session.actionCards.map((card) => card.cardId)).not.toContain(SMALL_FRIENDS)
        session.chooseAction(ActionType.Trade)
        expect(listed(session)).toContain(BIRDSONG)
        expect(listed(session)).not.toContain(SMALL_FRIENDS)
        // A Beast card at a site again: it is listed in both.
        const back = (await sessionAt(friends())).session
        expect(back.actionCards.map((card) => card.cardId)).toContain(SMALL_FRIENDS)
        back.chooseAction(ActionType.Trade)
        expect(listed(back)).toContain(SMALL_FRIENDS)
    })

    it('without it in use there are no far rows; with it on, the rows wait for the site and Map Library goes', async () => {
        const { session } = await sessionAt(friends())
        session.chooseAction(ActionType.Trade)
        expect(rows(session)).toEqual([TOLL_ROADS, ORACLE, MAP_LIBRARY])
        expect(listed(session)).toEqual(
            expect.arrayContaining([BIRDSONG, SMALL_FRIENDS, MAP_LIBRARY])
        )
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        const [legal] = session.modifiers.choicesOf(smallFriends(session))
        expect(legal?.spec.what).toBe('the site you act as if you are at')
        expect(legal?.options).toEqual([
            { kind: PowerChoiceKind.Site, siteId: 'p1' },
            { kind: PowerChoiceKind.Site, siteId: 'h1' }
        ])
        expect(session.modifiers.picksPending).toBe(true)
        expect(rows(session)).toEqual([])
        expect(listed(session)).toEqual(expect.arrayContaining([BIRDSONG, SMALL_FRIENDS]))
        expect(listed(session)).not.toContain(MAP_LIBRARY)
    })

    it("the Plains picked: only the Wolves' row, 3 favor (two Beast advisers), Birdsong still waives the Supply", async () => {
        const { session, sent } = await sessionAt(friends())
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        pickSite(session, 0)
        expect(session.modifiers.picksPending).toBe(false)
        expect(rows(session)).toEqual([WOLVES])
        expect(favorFor(session, WOLVES)).toBe(3)
        expect(listed(session)).not.toContain(OAK)
        expect(listed(session)).not.toContain(MAP_LIBRARY)
        await session.chooseTrade(WOLVES, TradeOption.ForFavor)
        const action = sent.mock.calls[0][0]
        assert(isTrade(action), 'a Trade is sent')
        expect(action.modifiers).toEqual(
            expect.arrayContaining([
                use(BIRDSONG),
                { ...use(SMALL_FRIENDS), choices: [{ kind: PowerChoiceKind.Site, siteId: 'p1' }] }
            ])
        )
    })

    it("the Mountain picked: The Old Oak's row, and its own modifier joins the Cards", async () => {
        const { session, sent } = await sessionAt(friends())
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        pickSite(session, 1)
        expect(rows(session)).toEqual([OAK])
        expect(listed(session)).toContain(OAK)
        session.modifiers.declare(use(OAK), true)
        const secrets = session.tradeRows[0]?.choices.find(
            (c) => c.option === TradeOption.ForSecrets
        )
        expect(secrets?.gain).toBe(3)
        await session.chooseTrade(OAK, TradeOption.ForSecrets)
        const action = sent.mock.calls[0][0]
        assert(isTrade(action), 'a Trade is sent')
        expect(action.modifiers).toEqual(
            expect.arrayContaining([
                use(OAK),
                { ...use(SMALL_FRIENDS), choices: [{ kind: PowerChoiceKind.Site, siteId: 'h1' }] }
            ])
        )
    })

    it('with one Beast site it is picked already, and the rows follow at once', async () => {
        const { session } = await sessionAt(friends({}, { h1: [] }))
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        expect(session.modifiers.picksPending).toBe(false)
        expect(rows(session)).toEqual([WOLVES])
    })

    it('with no faceup Beast site it is not in the Cards, and the rows stay at the pawn', async () => {
        const { session } = await sessionAt(friends({}, { p1: [], h1: [] }))
        session.chooseAction(ActionType.Trade)
        expect(listed(session)).not.toContain(SMALL_FRIENDS)
        expect(listed(session)).toEqual(expect.arrayContaining([BIRDSONG, MAP_LIBRARY]))
        expect(session.modifiers.options.map((power) => power.cardId)).not.toContain(SMALL_FRIENDS)
        // Not usable, so it cannot be put in use: no pick waits and the rows stay.
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        expect(session.modifiers.isDeclared(use(SMALL_FRIENDS))).toBe(false)
        expect(session.modifiers.picksPending).toBe(false)
        expect(rows(session)).toEqual([TOLL_ROADS, ORACLE, MAP_LIBRARY])
    })

    it('putting it down brings back the own site’s rows and cards', async () => {
        const { session } = await sessionAt(friends())
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        pickSite(session, 1)
        session.modifiers.declare(use(SMALL_FRIENDS), false)
        expect(rows(session)).toEqual([TOLL_ROADS, ORACLE, MAP_LIBRARY])
        expect(listed(session)).toContain(MAP_LIBRARY)
        expect(listed(session)).not.toContain(OAK)
    })

    it('Birdsong and Small Friends together make a Trade possible at 0 Supply: the powers list opens it on the Wolves', async () => {
        const { session } = await sessionAt(
            friends({ supply: 0 }, { c1: [TOLL_ROADS], c2: [], h1: [] })
        )
        expect(session.actionCards).toEqual([
            expect.objectContaining({
                cardId: BIRDSONG,
                action: ActionType.Trade,
                kind: 'makesPossible',
                with: use(SMALL_FRIENDS)
            })
        ])
        session.openActionWithCard(session.actionCards[0])
        expect(rows(session)).toEqual([WOLVES])
    })

    it("a Small Friends at the pawn's site picks the Mountain: it stays in use and the rows follow there", async () => {
        const { session, sent } = await sessionAt(
            friends(
                { advisers: [adviser(BIRDSONG)] },
                { c1: [TOLL_ROADS, MAP_LIBRARY, SMALL_FRIENDS] }
            )
        )
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        const [legal] = session.modifiers.choicesOf(smallFriends(session))
        const mountain =
            legal?.options.findIndex((o) => o.kind === PowerChoiceKind.Site && o.siteId === 'h1') ??
            -1
        expect(mountain).toBeGreaterThanOrEqual(0)
        pickSite(session, mountain)
        expect(session.modifiers.isDeclared(use(SMALL_FRIENDS))).toBe(true)
        expect(session.modifiers.options.map((power) => power.cardId)).toContain(SMALL_FRIENDS)
        expect(session.modifiers.picksPending).toBe(false)
        expect(rows(session)).toEqual([OAK])
        expect(listed(session)).toEqual(expect.arrayContaining([SMALL_FRIENDS, BIRDSONG, OAK]))
        expect(listed(session)).not.toContain(MAP_LIBRARY)
        await session.chooseTrade(OAK, TradeOption.ForFavor)
        const action = sent.mock.calls[0][0]
        assert(isTrade(action), 'a Trade is sent')
        expect(action.modifiers).toEqual(
            expect.arrayContaining([
                { ...use(SMALL_FRIENDS), choices: [{ kind: PowerChoiceKind.Site, siteId: 'h1' }] }
            ])
        )
    })

    it('in a game created before revision 19 it asks for no site and reaches every Beast site, as recorded', async () => {
        const { session } = await sessionAt(friends({}, {}, OathRevision.EngineFixes14))
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(SMALL_FRIENDS), true)
        expect(session.modifiers.picksPending).toBe(false)
        expect(rows(session)).toEqual(expect.arrayContaining([TOLL_ROADS, WOLVES, OAK]))
    })
})

describe('Master of Disguise in the Trade menu: the borrowed advisers listed', () => {
    it("lists Ann's Secret Signal with their name and drops Dana's other advisers", async () => {
        const { session } = await sessionAt(disguise())
        session.chooseAction(ActionType.Trade)
        expect(listed(session)).toEqual(expect.arrayContaining([BIRDSONG, RETURN, MASTER]))
        session.modifiers.declare(use(MASTER), true)
        expect(listed(session).sort()).toEqual([MASTER, SIGNAL].sort())
        const signal = listedCard(session, SIGNAL)
        const master = listedCard(session, MASTER)
        expect(session.modifiers.lenderOf(signal)).toBe('Ann')
        expect(session.modifiers.lenderOf(master)).toBeUndefined()
        expect([
            favorFor(session, TOLL_ROADS),
            favorFor(session, ROWDY_PUB),
            favorFor(session, ORACLE)
        ]).toEqual([1, 3, 1])
    })

    it('Secret Signal turned on: the one-favor trades gain two, and the Trade sends it beside Master of Disguise', async () => {
        const { session, sent } = await sessionAt(disguise())
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(MASTER), true)
        session.modifiers.declare(use(SIGNAL), true)
        expect([
            favorFor(session, TOLL_ROADS),
            favorFor(session, ROWDY_PUB),
            favorFor(session, ORACLE)
        ]).toEqual([2, 3, 2])
        await session.chooseTrade(TOLL_ROADS, TradeOption.ForFavor)
        const action = sent.mock.calls[0][0]
        assert(isTrade(action), 'a Trade is sent')
        expect(action.modifiers).toEqual([
            { ...use(MASTER), choices: [{ kind: PowerChoiceKind.Player, playerId: 'Ann' }] },
            use(SIGNAL)
        ])
    })

    it("putting Master of Disguise down brings back Dana's own advisers", async () => {
        const { session } = await sessionAt(disguise())
        session.chooseAction(ActionType.Trade)
        session.modifiers.declare(use(MASTER), true)
        session.modifiers.declare(use(SIGNAL), true)
        session.modifiers.declare(use(MASTER), false)
        expect(listed(session)).toEqual(expect.arrayContaining([BIRDSONG, RETURN, MASTER]))
        expect(listed(session)).not.toContain(SIGNAL)
        expect(session.modifiers.isDeclared(use(SIGNAL))).toBe(false)
    })
})

describe("the Trade rows on the player's own view", () => {
    it('read the same as on the table, nothing hidden read', () => {
        const me: Visibility.Perspective = { kind: 'player', playerId: 'Dana' }
        const own = (state: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(state, me)), me)
        const atOak: ModifierUse[] = [
            { ...use(SMALL_FRIENDS), choices: [{ kind: PowerChoiceKind.Site, siteId: 'h1' }] }
        ]
        const sf = friends()
        expect(tradeRows(own(sf), 'Dana', atOak)).toEqual(tradeRows(sf, 'Dana', atOak))
        expect(tradeRows(own(sf), 'Dana', atOak).map((row) => row.cardId)).toEqual([OAK])
        const borrowed: ModifierUse[] = [
            { ...use(MASTER), choices: [{ kind: PowerChoiceKind.Player, playerId: 'Ann' }] },
            use(SIGNAL)
        ]
        const md = disguise()
        expect(tradeRows(own(md), 'Dana', borrowed)).toEqual(tradeRows(md, 'Dana', borrowed))
    })
})
