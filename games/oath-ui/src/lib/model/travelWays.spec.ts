import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import { ActionType, MachineState, PowerTiming, SearchSource, isTravel, powerIndexOf } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const WAY_STATION = 'denizen.nomad.way-station'
const TENTS = 'denizen.nomad.tents'

function travelling(me: { supply: number }, denizensBySite: Record<string, string[]>) {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 3, ...me }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'h1', favor: 3 })
        ],
        {
            machineState: MachineState.ActPhase,
            denizensBySite,
            warbandsBySite: { c1: { me: 1 }, c2: { ann: 1 } }
        }
    )
    openTurn(state, 'me')
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Travel)
    return { session, sent }
}

describe('Travel offers the choices a Travel carries (R-7.1.4, R-11.12, R-X.1)', () => {
    it("Way Station's favor is offered beside Supply, and the one picked is sent", async () => {
        const { session, sent } = travelling({ supply: 3 }, { c1: [], c2: [WAY_STATION] })
        const ways = session.travelRows.find((row) => row.slotId === 'c2')?.ways ?? []
        expect(ways.map((w) => w.discountTolls)).toEqual([[], [WAY_STATION]])

        await session.travelTo('c2', ways[1])
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.tolls).toEqual([WAY_STATION])
    })

    it('a destination with one legal way is one button, and the button sends', async () => {
        const { session, sent } = travelling({ supply: 3 }, { c1: [], c2: [] })
        const ways = session.travelRows.find((row) => row.slotId === 'c2')?.ways ?? []
        expect(ways).toHaveLength(1)
        await session.travelTo('c2', ways[0])
        expect(sent).toHaveBeenCalledOnce()
    })

    it('R-7.4 — a declared modifier lights the destination it makes affordable (Tents at 0 Supply)', () => {
        const { session } = travelling({ supply: 0 }, { c1: [TENTS], c2: [] })
        expect(session.selectableSites).not.toContain('c2')
        session.modifiers.declare({ cardId: TENTS, powerIndex: powerIndexOf(TENTS, PowerTiming.Modifier) }, true)
        expect(session.selectableSites).toContain('c2')
    })
})

describe('R-7.4 — a declared modifier lights the Muster and Search targets it makes affordable', () => {
    function actingAt0Supply(me: Record<string, unknown>, denizensBySite: Record<string, string[]>, action: ActionType) {
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', supply: 0, favor: 3, secrets: 2, ...me })],
            {
                machineState: MachineState.ActPhase,
                denizensBySite,
                warbandsBySite: { c1: { me: 1 } },
                discardPileCounts: { cradle: 3, provinces: 0, hinterland: 0 }
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        session.chooseAction(action)
        return session
    }

    it('Animal Playmates lights a beast card to muster on at 0 Supply', () => {
        const PLAYMATES = 'denizen.beast.animal-playmates'
        const WOLVES = 'denizen.beast.wolves'
        const session = actingAt0Supply({ advisers: [{ cardId: PLAYMATES, faceUp: true }] }, { c1: [WOLVES] }, ActionType.Muster)
        expect(session.selectableCards).not.toContain(WOLVES)
        session.modifiers.declare({ cardId: PLAYMATES, powerIndex: powerIndexOf(PLAYMATES, PowerTiming.Modifier) }, true)
        expect(session.selectableCards).toContain(WOLVES)
    })

    it('Mushrooms lights the discard pile to search at 0 Supply', () => {
        const MUSHROOMS = 'denizen.beast.mushrooms'
        const session = actingAt0Supply({}, { c1: [MUSHROOMS] }, ActionType.Search)
        expect(session.searchRows.map((row) => row.source)).not.toContain(SearchSource.Discard)
        session.modifiers.declare({ cardId: MUSHROOMS, powerIndex: powerIndexOf(MUSHROOMS, PowerTiming.Modifier) }, true)
        expect(session.searchRows.map((row) => row.source)).toContain(SearchSource.Discard)
    })
})

describe('R-11.12 — the Buried Giant offers a flipped secret beside the Supply', () => {
    it('offers both ways to a destination, and the flip picked is sent', async () => {
        const state = testState(
            [
                testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', supply: 3, secrets: 1 }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'h1' })
            ],
            {
                machineState: MachineState.ActPhase,
                siteCards: { c1: 'site.buried-giant', c2: 'site.river' },
                warbandsBySite: { c1: { me: 1 } }
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.Travel)
        const ways = session.travelRows.find((row) => row.slotId === 'c2')?.ways ?? []
        expect(ways.map((w) => w.flipSecret)).toEqual([false, true])

        await session.travelTo('c2', ways[1])
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.siteId).toBe('c2')
        expect(action.flipSecret).toBe(true)
    })
})

describe('R-11.7 — leaving a Shrouded Wood an enemy rules', () => {
    it('offers one Travel, naming no site, and sends it for the ruler to answer', async () => {
        const state = testState(
            [
                testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', supply: 3 }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'h1' })
            ],
            {
                machineState: MachineState.ActPhase,
                siteCards: { c1: 'site.shrouded-wood', c2: 'site.river' },
                warbandsBySite: { c1: { ann: 1 } }
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.Travel)
        expect(session.shroudedWoodChooser).toBe('ann')
        expect(session.selectableSites).toEqual([])
        await session.travelFromShroudedWood()
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.siteId).toBeUndefined()
    })
})

describe('Travel picked on the map, as a phone does (Choose a Travel destination)', () => {
    it('a lit site with one way to pay travels at once', async () => {
        const { session, sent } = travelling({ supply: 3 }, { c1: [], c2: [] })
        await session.pickTravelSite('c2')
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.siteId).toBe('c2')
    })

    it('a lit site with two ways opens its ways and sends nothing; the map stays lit, the site marked picked', async () => {
        const { session, sent } = travelling({ supply: 3 }, { c1: [], c2: [WAY_STATION] })
        const lit = session.selectableSites
        await session.pickTravelSite('c2')
        expect(sent).not.toHaveBeenCalled()
        expect(session.travelWaysOpen?.slotId).toBe('c2')
        expect(session.travelWaysOpen?.ways.map((w) => w.discountTolls)).toEqual([[], [WAY_STATION]])
        expect(session.selectableSites).toEqual(lit)
        const picked = session.siteOffers.filter((offer) => offer.intent === 'travel' && offer.picked)
        expect(picked.map((offer) => offer.slotId)).toEqual(['c2'])
        expect(session.travelRows.map((row) => row.slotId)).toEqual(lit)

        const [, wayStation] = session.travelWaysOpen?.ways ?? []
        await session.travelTo('c2', wayStation)
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.tolls).toEqual([WAY_STATION])
    })

    it('Undo closes the ways and leaves Travel chosen; a newly shown state closes them', async () => {
        const { session } = travelling({ supply: 3 }, { c1: [], c2: [WAY_STATION] })
        await session.pickTravelSite('c2')
        await session.undo()
        expect(session.travelWaysOpen).toBeUndefined()
        expect(session.selection.action).toBe(ActionType.Travel)

        await session.pickTravelSite('c2')
        session.beforeNewState()
        expect(session.travelWaysOpen).toBeUndefined()
    })

    it('a site the engine does not accept is neither sent nor opened', async () => {
        const { session, sent } = travelling({ supply: 0 }, { c1: [], c2: [] })
        expect(session.selectableSites).not.toContain('h2')
        await session.pickTravelSite('h2')
        expect(sent).not.toHaveBeenCalled()
        expect(session.travelWaysOpen).toBeUndefined()
    })
})
