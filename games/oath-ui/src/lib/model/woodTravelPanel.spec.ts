import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, assert, createAction, type GameAction } from '@tabletop/common'
import {
    ActionType,
    HydratedTravel,
    MachineState,
    PowerQuestionKind,
    Region,
    Travel,
    isAnswerQuestion,
    isTravel,
    woodPicksBeforeTravel
} from '@tabletop/oath'
import { disposeSessions, openSessionOn, played, tableOf } from '$lib/testing/sessionHarness.js'
import {
    FOREST_PATHS,
    PORTAL,
    TENTS,
    WOOD_SLOTS,
    travelCard,
    woodCardsLowState,
    woodCardsState,
    type WoodCardsScene
} from '$lib/testing/woodCardsTable.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { gridRefusal } from './actionAvailability.js'
import { describeAction, rowActorOf } from './actionDescription.js'
import { woodRegions } from './woodTravel.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const { plains, wood, greatSlum, river, mountain, hiddenPlace, wastes, drownedCity } = WOOD_SLOTS

async function travellerSession(scene: WoodCardsScene = {}) {
    const session = await openSessionOn(tableOf(woodCardsState(scene)))
    session.chooseAction(ActionType.Travel)
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    return { session, sent }
}

const listedCards = (session: Awaited<ReturnType<typeof travellerSession>>['session']) =>
    session.modifiers.listed.map((power) => power.cardId).sort()

describe('R-11.7-H2 — the traveller’s cards on a Travel out of an enemy’s Shrouded Wood', () => {
    it('the Cards rows list every Travel card Dana can use there, as on any Travel', async () => {
        const { session } = await travellerSession()
        expect(session.shroudedWoodChooser).toBe('Bea')
        expect(listedCards(session)).toEqual([PORTAL, FOREST_PATHS, TENTS].sort())
    })

    it('with Tents and Forest Paths in use, the price row is one cell per region, price and card', async () => {
        const { session } = await travellerSession()
        session.modifiers.declare(travelCard(TENTS), true)
        session.modifiers.declare(travelCard(FOREST_PATHS), true)
        expect(session.shroudedWoodChooser).toBe('Bea')
        expect(session.woodRegions?.map((r) => [r.region, r.cost, r.foldedBy, r.siteIds])).toEqual([
            [Region.Cradle, 0, [FOREST_PATHS], [plains]],
            [Region.Cradle, 2, [], [drownedCity]],
            [Region.Provinces, 0, [TENTS], [greatSlum, river]],
            [Region.Hinterland, 0, [FOREST_PATHS], [hiddenPlace]],
            [Region.Hinterland, 2, [], [mountain, wastes]]
        ])
    })

    it('the Travel is sent with the cards in use, and the ruler is then offered the same picks', async () => {
        const { session, sent } = await travellerSession()
        session.modifiers.declare(travelCard(TENTS), true)
        session.modifiers.declare(travelCard(FOREST_PATHS), true)
        const shown = session.woodRegions?.flatMap((r) =>
            r.siteIds.map((siteId) => [siteId, r.cost])
        )
        await session.travelFromShroudedWood()
        const action = sent.mock.calls[0]?.[0]
        assert(action && isTravel(action), 'the Travel is sent')
        expect(action.modifiers).toEqual([travelCard(TENTS), travelCard(FOREST_PATHS)])
        expect(action.siteId).toBeUndefined()

        const state = woodCardsState()
        const table = played(tableOf(state), [
            createAction(Travel, {
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: 'Dana',
                modifiers: action.modifiers
            })
        ])
        const ruler = await openSessionOn(table)
        expect(ruler.myPlayer?.id).toBe('Bea')
        const offered = ruler.question.woodRegions.flatMap((r) =>
            r.siteIds.map((siteId) => [siteId, r.cost])
        )
        expect(offered.sort()).toEqual((shown ?? []).sort())
    })

    it('two sites free in one region by different cards stay two cells, each naming its card', () => {
        const state = woodCardsState()
        const picks = [
            { siteId: greatSlum, cost: 0, base: 2, foldedBy: [TENTS] },
            { siteId: river, cost: 0, base: 2, foldedBy: [FOREST_PATHS] },
            { siteId: wood, cost: 0, base: 2, foldedBy: [TENTS] }
        ]
        expect(
            woodRegions(state, picks).map((r) => [r.region, r.cost, r.foldedBy, r.siteIds])
        ).toEqual([
            [Region.Provinces, 0, [TENTS], [greatSlum, wood]],
            [Region.Provinces, 0, [FOREST_PATHS], [river]]
        ])
    })

    it('a card that cannot apply anywhere is not listed: Forest Paths with no Beast site on the map', async () => {
        const state = woodCardsState()
        state.denizensBySite = { ...state.denizensBySite, [plains]: [], [hiddenPlace]: [] }
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Travel)
        expect(listedCards(session)).toEqual([PORTAL, TENTS].sort())
    })

    it('the panel’s picks are the engine’s, with the cards’ costs counted as placed', async () => {
        const { session } = await travellerSession({
            supply: 1,
            favor: 1,
            advisers: [FOREST_PATHS]
        })
        session.modifiers.declare(travelCard(FOREST_PATHS), true)
        const engine = woodPicksBeforeTravel(session.gameState, 'Dana', [
            travelCard(FOREST_PATHS)
        ]).map(({ pick }) => pick.siteId)
        expect(engine).toEqual([plains, hiddenPlace])
        expect(session.woodRegions?.flatMap((r) => r.siteIds)).toEqual(engine)
        expect(session.woodTravelRefusal).toBeUndefined()
    })
})

describe('R-11.7-H2 — the Travel tile, as the engine opens it', () => {
    const lowState = woodCardsLowState

    it('opens with 1 Supply when Forest Paths makes a Beast site free', async () => {
        const state = lowState([FOREST_PATHS])
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(state, 'Dana', {})).toBe(
            'Bea would pick where you go, and you can pay for no site: the cheapest is 2 Supply, you have 1'
        )
        expect(HydratedTravel.canDoTravel(state, 'Dana')).toBe(true)
        const session = await openSessionOn(tableOf(state))
        expect(session.validActionTypes).toContain(ActionType.Travel)
        expect(gridRefusal(session.gameState, 'Dana', ActionType.Travel)).toBeUndefined()
    })

    it('control: with no card that helps it stays greyed, the cheapest pick named', async () => {
        const state = lowState([])
        expect(HydratedTravel.canDoTravel(state, 'Dana')).toBe(false)
        const session = await openSessionOn(tableOf(state))
        expect(gridRefusal(session.gameState, 'Dana', ActionType.Travel)).toEqual({
            cause: 'supply',
            needs: 2,
            has: 1
        })
    })

    it('opened, with no card in use yet: the button is refused with the grid’s words; Forest Paths in use lifts it', async () => {
        const session = await openSessionOn(tableOf(lowState([FOREST_PATHS])))
        session.chooseAction(ActionType.Travel)
        expect(session.woodTravelRefusal).toBe('Needs 2 Supply; you have 1.')
        session.modifiers.declare(travelCard(FOREST_PATHS), true)
        expect(session.woodTravelRefusal).toBeUndefined()
    })
})

describe('R-11.7-H2 — the Wood’s Travel cards with the other Travel cards and powers', () => {
    const ENVOY = 'denizen.nomad.special-envoy'
    const DRUM = 'relic.dragonskin-drum'
    const TOLL_ROADS = 'denizen.order.toll-roads'

    it('Special Envoy is listed and, in use, makes every pick free: one price, said once', async () => {
        const { session } = await travellerSession({ advisers: [ENVOY] })
        expect(listedCards(session)).toContain(ENVOY)
        session.modifiers.declare(travelCard(ENVOY), true)
        const regions = session.woodRegions ?? []
        expect(regions.map((r) => [r.region, r.cost, r.foldedBy])).toEqual([
            [Region.Cradle, 0, [ENVOY]],
            [Region.Provinces, 0, [ENVOY]],
            [Region.Hinterland, 0, [ENVOY]]
        ])
    })

    it('on a free Travel (Second Wind) the cards are listed and every pick is free, as today', async () => {
        const state = woodCardsState()
        state.getPlayerState('Dana').freeTravelAtAction = state.actionCount
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Travel)
        expect(session.woodTravelIsFree).toBe(true)
        expect(listedCards(session)).toEqual([PORTAL, FOREST_PATHS, TENTS].sort())
        session.modifiers.declare(travelCard(TENTS), true)
        expect(new Set(session.woodRegions?.map((r) => r.cost))).toEqual(new Set([0]))
    })

    it('the Dragonskin Drum starts in use, changes no price, and is sent with the Travel', async () => {
        const state = woodCardsState()
        state.getPlayerState('Dana').relicIds = [DRUM]
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Travel)
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        expect(listedCards(session)).toContain(DRUM)
        expect(session.modifiers.isDeclared(travelCard(DRUM))).toBe(true)
        expect(session.woodRegions?.map((r) => [r.region, r.cost])).toEqual([
            [Region.Cradle, 2],
            [Region.Provinces, 2],
            [Region.Hinterland, 2]
        ])
        await session.travelFromShroudedWood()
        const action = sent.mock.calls[0]?.[0]
        assert(action && isTravel(action), 'the Travel is sent')
        expect(action.modifiers).toEqual([travelCard(DRUM)])
    })

    it('Hospitality, in use from the start of any Travel, is declared at the Wood with no bank (revision 15), and sent with Tents', async () => {
        const HOSPITALITY = 'denizen.nomad.hospitality'
        const { session, sent } = await travellerSession({ advisers: [TENTS, HOSPITALITY] })
        expect(session.modifiers.isDeclared(travelCard(HOSPITALITY))).toBe(true)
        // Way Station (Nomad) at the Great Slum matches Hospitality (Nomad): a pick there gains.
        expect(listedCards(session)).toEqual([HOSPITALITY, PORTAL, TENTS].sort())
        session.modifiers.declare(travelCard(TENTS), true)
        expect(session.woodRegions?.find((r) => r.region === Region.Provinces)).toMatchObject({
            cost: 0,
            foldedBy: [TENTS]
        })
        expect(session.woodTravelReason).toBeUndefined()
        await session.travelFromShroudedWood()
        const action = sent.mock.calls[0]?.[0]
        assert(action && isTravel(action), 'the Travel is sent')
        expect(action.modifiers).toEqual([
            { ...travelCard(HOSPITALITY), choices: [] },
            travelCard(TENTS)
        ])
    })

    it('before revision 15 the Dragonskin Drum, in use from the start, is not declared: the Travel goes as before', async () => {
        const state = shroudedWoodState(2)
        state.getPlayerState('Dana').relicIds = [DRUM]
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Travel)
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        expect(session.modifiers.isDeclared(travelCard(DRUM))).toBe(true)
        expect(session.modifiers.listed).toEqual([])
        expect(session.woodTravelReason).toBeUndefined()
        await session.travelFromShroudedWood()
        const action = sent.mock.calls[0]?.[0]
        assert(action && isTravel(action), 'the Travel is sent')
        expect(action.modifiers).toEqual([])
    })

    it('Toll Roads at a site Tents makes free: still marked on the ruler’s pick, which waits on the toll', async () => {
        const state = woodCardsState()
        state.denizensBySite = { ...state.denizensBySite, [river]: [TOLL_ROADS] }
        state.warbandsBySite = { ...state.warbandsBySite, [river]: { Bea: 1 } }
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Travel)
        session.modifiers.declare(travelCard(TENTS), true)
        expect(session.woodRegions?.find((r) => r.siteIds.includes(river))).toMatchObject({
            cost: 0,
            foldedBy: [TENTS]
        })
        const table = played(tableOf(state), [
            createAction(Travel, {
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: 'Dana',
                modifiers: [travelCard(TENTS)]
            })
        ])
        const ruler = await openSessionOn(table)
        expect(ruler.question.woodDestinations).toContain(river)
        expect(ruler.question.woodTollAt(river)).toBe(true)
    })
})

describe('R-11.7-H4 — Portal in use at its own Wood: the ordinary Travel', () => {
    it('nobody picks: every site is lit at 0 Supply, and the Wood’s panel goes', async () => {
        const { session } = await travellerSession()
        session.modifiers.declare(travelCard(PORTAL), true)
        expect(session.shroudedWoodChooser).toBeUndefined()
        expect(session.woodRegions).toBeUndefined()
        const sites = [drownedCity, plains, greatSlum, river, mountain, hiddenPlace, wastes]
        expect([...session.selectableSites].sort()).toEqual([...sites].sort())
        expect(session.travelRows.every((row) => row.ways.every((way) => way.cost === 0))).toBe(
            true
        )
        session.modifiers.declare(travelCard(PORTAL), false)
        expect(session.shroudedWoodChooser).toBe('Bea')
    })
})

describe('R-11.7-H2 — the ruler’s answer "<traveller> stays"', () => {
    async function rulerSession(scene: WoodCardsScene, cards: string[]) {
        const state = woodCardsState(scene)
        const table = played(tableOf(state), [
            createAction(Travel, {
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: 'Dana',
                modifiers: cards.map(travelCard)
            })
        ])
        const session = await openSessionOn(table)
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        return { session, sent }
    }

    it('offered when Dana can pay for nothing without Forest Paths, and sent as the stay', async () => {
        const { session, sent } = await rulerSession(
            { supply: 1, favor: 1, advisers: [FOREST_PATHS] },
            [FOREST_PATHS]
        )
        expect(session.myPlayer?.id).toBe('Bea')
        expect(session.question.woodDestinations).toEqual([plains, hiddenPlace])
        expect(session.question.woodStayOffered).toBe(true)
        await session.question.keepTravelerInPlace()
        const answer = sent.mock.calls[0]?.[0]
        assert(answer && isAnswerQuestion(answer), 'the stay is sent')
        expect(answer.answer).toEqual({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            stay: true
        })
    })

    it('not offered while Dana could pay for a site without the cards', async () => {
        const { session, sent } = await rulerSession({}, [TENTS, FOREST_PATHS])
        expect(session.question.woodStayOffered).toBe(false)
        await session.question.keepTravelerInPlace()
        expect(sent).not.toHaveBeenCalled()
    })
})

describe('R-11.7-H2 — the History of a Travel out of the Wood with cards', () => {
    const SITES: Record<string, string> = {
        [wood]: 'Shrouded Wood',
        [river]: 'River',
        [mountain]: 'Mountain'
    }
    const names = {
        player: (playerId: string) => playerId,
        site: (slotId: string) => SITES[slotId] ?? slotId,
        seats: ['Dana', 'Bea', 'Ann']
    }
    const row = (
        fields: { type: ActionType; playerId?: string } & Record<string, unknown>
    ): GameAction => ({ id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields })

    function answered(
        metadata: Record<string, unknown>,
        answer: Record<string, unknown>
    ): GameAction {
        return row({
            type: ActionType.AnswerQuestion,
            playerId: 'Bea',
            answer: { kind: PowerQuestionKind.ShroudedWoodDestination, ...answer },
            metadata: {
                cardId: 'site.shrouded-wood',
                kind: PowerQuestionKind.ShroudedWoodDestination,
                resumeMachineState: MachineState.ActPhase,
                last: true,
                ...metadata
            }
        })
    }

    it('the set-out row names the declared cards in brackets, as a plain Travel does', () => {
        const out = row({
            type: ActionType.Travel,
            playerId: 'Dana',
            modifiers: [travelCard(TENTS), travelCard(FOREST_PATHS)],
            metadata: {
                fromSiteId: wood,
                destinationChooser: 'Bea',
                paysAtPick: true,
                supplySpent: 0,
                supplyRemaining: 3,
                modifiers: [TENTS, FOREST_PATHS]
            }
        })
        expect(describeAction(out, names, 'Dana')).toBe(
            'set out from Shrouded Wood (Tents, Forest Paths); Bea picks where'
        )
        const plain = row({
            type: ActionType.Travel,
            playerId: 'Dana',
            modifiers: [],
            metadata: {
                fromSiteId: wood,
                destinationChooser: 'Bea',
                paysAtPick: true,
                supplySpent: 0,
                supplyRemaining: 3
            }
        })
        expect(describeAction(plain, names, 'Dana')).toBe(
            'set out from Shrouded Wood; Bea picks where'
        )
    })

    it('the pick names a card only where it set the price', () => {
        const free = answered(
            {
                summary: 'sent Dana',
                woodPick: {
                    travelerPlayerId: 'Dana',
                    siteId: river,
                    supplySpent: 0,
                    supplyRemaining: 3,
                    pricedBy: [TENTS]
                }
            },
            { siteId: river }
        )
        expect(describeAction(free, names, 'Ann')).toBe(
            "traveled from Shrouded Wood to River (Bea's pick), spending 0 Supply (Tents)"
        )
        const paid = answered(
            {
                summary: 'sent Dana',
                woodPick: {
                    travelerPlayerId: 'Dana',
                    siteId: mountain,
                    supplySpent: 2,
                    supplyRemaining: 1
                }
            },
            { siteId: mountain }
        )
        expect(describeAction(paid, names, 'Ann')).toBe(
            "traveled from Shrouded Wood to Mountain (Bea's pick), spending 2 Supply"
        )
    })

    it('"Dana stays" is the traveller’s row: stayed at Shrouded Wood (Bea’s pick)', () => {
        const stay = answered(
            {
                summary: `kept Dana at ${wood}`,
                woodStay: { travelerPlayerId: 'Dana', siteId: wood }
            },
            { stay: true }
        )
        expect(rowActorOf(stay)).toBe('Dana')
        expect(describeAction(stay, names, 'Ann')).toBe("stayed at Shrouded Wood (Bea's pick)")
        expect(describeAction(stay, names, 'Bea')).toBe('stayed at Shrouded Wood (your pick)')
    })
})
