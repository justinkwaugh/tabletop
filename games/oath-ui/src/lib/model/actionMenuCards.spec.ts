import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    PowerTiming,
    Suit,
    TradeOption,
    cardDefinitions,
    isFreeGain,
    isMandatoryModifier,
    isMuster,
    isTrade,
    isTravel,
    powerIndexOf,
    powersWithTiming
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { ACTION_CARD_LINES, actionCardKey } from './actionCards.js'
import type { OathGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const DRUM = 'relic.dragonskin-drum'
const CUP = 'relic.cup-of-plenty'
const TENTS = 'denizen.nomad.tents'
const TYRANT = 'denizen.order.tyrant'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const PLAYMATES = 'denizen.beast.animal-playmates'
const DOWNTRODDEN = 'denizen.discord.downtrodden'
const PRESSGANGS = 'denizen.order.pressgangs'
const INITIATION_RITE = 'denizen.arcane.initiation-rite'
const BIRDSONG = 'denizen.beast.birdsong'
const SECRET_SIGNAL = 'denizen.arcane.secret-signal'
const OLD_OAK = 'denizen.beast.the-old-oak'
const SMALL_FRIENDS = 'denizen.beast.small-friends'
const WILD_CRY = 'denizen.beast.wild-cry'
const WELCOMING_PARTY = 'denizen.hearth.welcoming-party'
const WOLVES = 'denizen.beast.wolves'
const INN = 'denizen.hearth.wayside-inn'
const COUNCIL_SEAT = 'denizen.order.council-seat'
const TOLL_ROADS = 'denizen.order.toll-roads'

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

type Seat = Parameters<typeof testPlayer>[0]

/** Dana at c1 with plenty to spend, her cards and the cards at her site as the case needs. */
function table(
    me: Partial<Seat>,
    here: string[] = [],
    tokens: Record<string, { favor: number; secrets: number }> = {}
) {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 5,
                favor: 5,
                secrets: 3,
                ...me
            })
        ],
        {
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: here, c2: [], p1: [], h1: [] },
            cardTokens: tokens,
            discardPileCounts: { cradle: 3, provinces: 3, hinterland: 3 }
        }
    )
    openTurn(state, 'Dana')
    return state
}

async function sessionAt(state: ReturnType<typeof table>) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    return { session, sent }
}

const advisers = (...cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))
const listed = (session: OathGameSession) => session.modifiers.listed.map((power) => power.cardId)

describe('R-7.4 — each free gain starts in use, and a tap puts it down', () => {
    const lowHearth = () => {
        const state = table({ advisers: advisers(DOWNTRODDEN) }, [INN])
        for (const suit of Object.values(Suit)) state.favorBank[suit] = 3
        state.favorBank[Suit.Hearth] = 1
        return state
    }
    const cases: { card: string; action: ActionType; state: () => ReturnType<typeof table> }[] = [
        { card: DRUM, action: ActionType.Travel, state: () => table({ relicIds: [DRUM] }) },
        { card: ROWDY_PUB, action: ActionType.Muster, state: () => table({}, [ROWDY_PUB, INN]) },
        {
            card: PLAYMATES,
            action: ActionType.Muster,
            state: () => table({ advisers: advisers(PLAYMATES) }, [WOLVES])
        },
        { card: DOWNTRODDEN, action: ActionType.Muster, state: lowHearth },
        {
            card: BIRDSONG,
            action: ActionType.Trade,
            state: () => table({ advisers: advisers(BIRDSONG) }, [WOLVES])
        },
        {
            card: CUP,
            action: ActionType.Trade,
            state: () => table({ relicIds: [CUP], advisers: advisers(WOLVES) }, [WOLVES])
        },
        {
            card: SECRET_SIGNAL,
            action: ActionType.Trade,
            state: () => table({ advisers: advisers(SECRET_SIGNAL) }, [WOLVES])
        },
        {
            card: OLD_OAK,
            action: ActionType.Trade,
            state: () => table({ advisers: advisers(WOLVES) }, [OLD_OAK])
        },
        {
            card: WILD_CRY,
            action: ActionType.Search,
            state: () => table({ advisers: advisers(WILD_CRY) })
        },
        {
            card: WELCOMING_PARTY,
            action: ActionType.Search,
            state: () => table({ advisers: advisers(WELCOMING_PARTY) })
        }
    ]

    for (const { card, action, state } of cases) {
        it(`${card} on ${action}`, async () => {
            const { session } = await sessionAt(state())
            session.chooseAction(action)
            expect(listed(session)).toContain(card)
            expect(session.modifiers.isDeclared(use(card))).toBe(true)

            session.modifiers.declare(use(card), false)
            expect(session.modifiers.isDeclared(use(card))).toBe(false)
            expect(listed(session), 'still offered, to tap back on').toContain(card)

            session.modifiers.declare(use(card), true)
            expect(session.modifiers.isDeclared(use(card))).toBe(true)
        })
    }

    it('names exactly the ten cards the engine flags', () => {
        expect(cases.map((c) => c.card).sort()).toEqual(
            allModifiers()
                .filter(isFreeGain)
                .map((power) => power.cardId)
                .sort()
        )
    })

    it('starts nothing else in use: a costed card starts off', async () => {
        const { session } = await sessionAt(table({ relicIds: [DRUM], advisers: advisers(TENTS) }))
        session.chooseAction(ActionType.Travel)
        expect(listed(session)).toEqual(expect.arrayContaining([TENTS, DRUM]))
        expect(session.modifiers.isDeclared(use(TENTS))).toBe(false)
        expect(session.modifiers.isDeclared(use(DRUM))).toBe(true)
    })

    it('a Travel sent at once carries the Drum', async () => {
        const { session, sent } = await sessionAt(table({ relicIds: [DRUM] }))
        session.chooseAction(ActionType.Travel)
        const [row] = session.travelRows
        assert(row !== undefined, 'a destination is lit')
        const [way] = row.ways
        assert(way !== undefined, 'it has a way to pay')
        await session.travelTo(row.slotId, way)
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.modifiers).toEqual([use(DRUM)])
    })

    it('Undo brings back a free gain a tap put down, then leaves the action', async () => {
        const { session } = await sessionAt(table({ relicIds: [DRUM] }))
        session.chooseAction(ActionType.Travel)
        session.modifiers.declare(use(DRUM), false)
        await session.undo()
        expect(session.selection.action).toBe(ActionType.Travel)
        expect(session.modifiers.isDeclared(use(DRUM))).toBe(true)
        await session.undo()
        expect(session.selection.action).toBeUndefined()
    })

    it('Undo takes a card tapped into use first, keeping the free gain, then leaves the action', async () => {
        const { session } = await sessionAt(table({ relicIds: [DRUM], advisers: advisers(TENTS) }))
        session.chooseAction(ActionType.Travel)
        session.modifiers.declare(use(TENTS), true)
        await session.undo()
        expect(session.selection.action).toBe(ActionType.Travel)
        expect(session.modifiers.isDeclared(use(TENTS))).toBe(false)
        expect(session.modifiers.isDeclared(use(DRUM))).toBe(true)
        await session.undo()
        expect(session.selection.action).toBeUndefined()
    })

    it('scenario 10: the action entered again starts with its free gain in use again', async () => {
        const { session } = await sessionAt(table({ relicIds: [DRUM], advisers: advisers(TENTS) }))
        session.chooseAction(ActionType.Travel)
        session.modifiers.declare(use(DRUM), false)
        session.modifiers.declare(use(TENTS), true)
        session.selection.reset()
        session.chooseAction(ActionType.Travel)
        expect(session.modifiers.isDeclared(use(DRUM))).toBe(true)
        expect(session.modifiers.isDeclared(use(TENTS))).toBe(false)
    })
})

describe('R-7.4 — a card in use applies to the rows it fits; the other rows are sent without it', () => {
    it('a Rowdy Pub in use leaves the other Musters listed, and sends them without it', async () => {
        const { session, sent } = await sessionAt(table({}, [ROWDY_PUB, INN, COUNCIL_SEAT]))
        session.chooseAction(ActionType.Muster)
        expect(session.modifiers.isDeclared(use(ROWDY_PUB))).toBe(true)
        const rows = session.musterRows
        expect(rows.map((row) => row.cardId)).toEqual([ROWDY_PUB, INN, COUNCIL_SEAT])
        const [pub, inn] = rows
        expect(pub.gain).toBe(inn.gain + 1)
        expect(pub.modifiers).toEqual([use(ROWDY_PUB)])
        expect(inn.modifiers).toEqual([])

        await session.chooseCard(INN)
        const action = sent.mock.calls[0][0]
        assert(isMuster(action), 'a Muster is sent')
        expect(action.cardId).toBe(INN)
        expect(action.modifiers).toEqual([])
    })

    it('a Muster on Rowdy Pub is sent with it', async () => {
        const { session, sent } = await sessionAt(table({}, [ROWDY_PUB, INN]))
        session.chooseAction(ActionType.Muster)
        await session.chooseCard(ROWDY_PUB)
        const action = sent.mock.calls[0][0]
        assert(isMuster(action), 'a Muster is sent')
        expect(action.modifiers).toEqual([use(ROWDY_PUB)])
    })

    it('Secret Signal fits the Trade for favor and not the one for secrets', async () => {
        const { session, sent } = await sessionAt(
            table({ advisers: advisers(SECRET_SIGNAL) }, [WOLVES])
        )
        session.chooseAction(ActionType.Trade)
        const [row] = session.tradeRows
        expect(row.choices.map((c) => [c.option, c.modifiers])).toEqual([
            [TradeOption.ForFavor, [use(SECRET_SIGNAL)]],
            [TradeOption.ForSecrets, []]
        ])
        await session.chooseTrade(WOLVES, TradeOption.ForSecrets)
        const action = sent.mock.calls[0][0]
        assert(isTrade(action), 'a Trade is sent')
        expect(action.modifiers).toEqual([])
    })

    it('a card that fits no row is not listed, and nothing sends it (The Old Oak with no beast adviser)', async () => {
        const { session, sent } = await sessionAt(table({}, [OLD_OAK]))
        session.chooseAction(ActionType.Trade)
        expect(session.modifiers.options.map((p) => p.cardId)).toContain(OLD_OAK)
        expect(listed(session)).not.toContain(OLD_OAK)
        await session.chooseTrade(OLD_OAK, TradeOption.ForSecrets)
        const action = sent.mock.calls[0][0]
        assert(isTrade(action), 'a Trade is sent')
        expect(action.modifiers).toEqual([])
    })

    it('a card the engine applies by itself is never a row (Tyrant, Initiation Rite)', async () => {
        const travel = (await sessionAt(table({ advisers: advisers(TYRANT, TENTS) }))).session
        travel.chooseAction(ActionType.Travel)
        expect(listed(travel)).not.toContain(TYRANT)
        const muster = (await sessionAt(table({ advisers: advisers(INITIATION_RITE) }, [INN])))
            .session
        muster.chooseAction(ActionType.Muster)
        expect(listed(muster)).toEqual([])
    })

    it('the Travel menu from an enemy’s Shrouded Wood lists no card and starts none in use, the Drum included', async () => {
        const state = shroudedWoodState(2)
        state.getPlayerState('Dana').relicIds.push(DRUM)
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Travel)
        expect(session.shroudedWoodChooser).toBe('Rhys')
        expect(session.modifiers.listed).toEqual([])
        expect(session.travelRows).toEqual([])
    })
})

describe('R-7.4 — an action only two cards together make possible is one entry in Use a power', () => {
    /** At 0 Supply, Wolves already carries a favor; Pressgangs opens it and Animal Playmates pays the Supply. */
    function m1() {
        return table({ supply: 0, favor: 2, advisers: advisers(PLAYMATES, PRESSGANGS) }, [WOLVES], {
            [WOLVES]: { favor: 1, secrets: 0 }
        })
    }

    it('Animal Playmates + Pressgangs is one "makes possible" entry for Muster; neither alone is listed', async () => {
        const { session } = await sessionAt(m1())
        expect(session.actionCards).toEqual([
            {
                cardId: PLAYMATES,
                powerIndex: use(PLAYMATES).powerIndex,
                action: ActionType.Muster,
                kind: 'makesPossible',
                with: use(PRESSGANGS)
            }
        ])
        expect(actionCardKey(session.actionCards[0])).toContain('+')
    })

    it('opens the Muster with both in use; neither can be put down; the Muster is sent with both', async () => {
        const { session, sent } = await sessionAt(m1())
        session.openActionWithCard(session.actionCards[0])
        expect(session.selection.action).toBe(ActionType.Muster)
        expect(session.modifiers.isDeclared(use(PLAYMATES))).toBe(true)
        expect(session.modifiers.isDeclared(use(PRESSGANGS))).toBe(true)
        session.modifiers.declare(use(PLAYMATES), false)
        session.modifiers.declare(use(PRESSGANGS), false)
        expect(session.modifiers.isDeclared(use(PLAYMATES))).toBe(true)
        expect(session.modifiers.isDeclared(use(PRESSGANGS))).toBe(true)
        expect(session.musterRows.map((row) => row.cardId)).toEqual([WOLVES])

        await session.chooseCard(WOLVES)
        const action = sent.mock.calls[0][0]
        assert(isMuster(action), 'a Muster is sent')
        expect(action.modifiers).toEqual([use(PLAYMATES), use(PRESSGANGS)])
    })

    it('Undo from a pair returns to the powers', async () => {
        const { session } = await sessionAt(m1())
        session.openActionWithCard(session.actionCards[0])
        await session.undo()
        expect(session.selection.action).toBe(ActionType.UseActionPower)
    })

    it('Birdsong + Small Friends make a Trade at 0 Supply with a beast card at another site', async () => {
        const state = testState(
            [
                testPlayer({
                    playerId: 'Dana',
                    color: Color.Red,
                    siteId: 'c1',
                    supply: 0,
                    favor: 2,
                    secrets: 1,
                    advisers: advisers(BIRDSONG, SMALL_FRIENDS)
                })
            ],
            {
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [WOLVES], h1: [] }
            }
        )
        openTurn(state, 'Dana')
        const { session } = await sessionAt(state)
        expect(session.actionCards).toEqual([
            expect.objectContaining({
                cardId: BIRDSONG,
                action: ActionType.Trade,
                kind: 'makesPossible',
                with: use(SMALL_FRIENDS)
            })
        ])
        session.openActionWithCard(session.actionCards[0])
        expect(session.tradeRows.map((row) => row.cardId)).toEqual([WOLVES])
    })

    it('pairs no card that alone makes the action possible (Tents, at 0 Supply)', async () => {
        const { session } = await sessionAt(
            table({ supply: 0, favor: 2, advisers: advisers(TENTS, PRESSGANGS) })
        )
        expect(session.actionCards.filter((card) => card.with !== undefined)).toEqual([])
    })
})

function allModifiers() {
    return cardDefinitions().flatMap((card) => powersWithTiming(card.id, PowerTiming.Modifier))
}

describe('R-7.4 — one line per card, read by the menu rows and Use a power alike', () => {
    it('every card a player may declare has its line; a card the engine applies by itself has none', () => {
        const optional = allModifiers().filter((power) => !isMandatoryModifier(power))
        const mandatory = allModifiers().filter(isMandatoryModifier)
        expect(Object.keys(ACTION_CARD_LINES).sort()).toEqual(optional.map((p) => p.cardId).sort())
        for (const power of mandatory) expect(ACTION_CARD_LINES[power.cardId]).toBeUndefined()
    })
})
