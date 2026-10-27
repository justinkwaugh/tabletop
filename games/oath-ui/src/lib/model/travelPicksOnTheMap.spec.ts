import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, createAction } from '@tabletop/common'
import { PowerQuestionKind, Region, Travel, shroudedWoodDestinations } from '@tabletop/oath'
import { disposeSessions, openSessionOn, played, tableOf } from '$lib/testing/sessionHarness.js'
import {
    WOOD_SLOTS,
    FOREST_PATHS,
    TENTS,
    travelCard,
    woodCardsState,
    type WoodCardsScene
} from '$lib/testing/woodCardsTable.js'
import { HORSE_WOOD_SITES, woodPickTable, type WoodPickScene } from '$lib/testing/woodPicksTable.js'
import { chipWords, mapPickOpening, pickChip, regionCounts } from './travelOnTheMap.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const { drownedCity, plains, wood, greatSlum, river, mountain, hiddenPlace, wastes } = WOOD_SLOTS

async function sessionOf(table: ReturnType<typeof woodPickTable>) {
    const session = await openSessionOn(table)
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { session, sent }
}

/** Dana has set out from Bea's Wood declaring `cards`; Bea's view. */
async function rulerOfOwnTravel(scene: WoodCardsScene, cards: string[]) {
    const state = woodCardsState(scene)
    return await sessionOf(
        played(tableOf(state), [
            createAction(Travel, {
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: 'Dana',
                modifiers: cards.map(travelCard)
            })
        ])
    )
}

const scene = (name: WoodPickScene) => sessionOf(woodPickTable(name))

type Session = Awaited<ReturnType<typeof sessionOf>>['session']

const offered = (session: Session) =>
    session.siteOffers
        .flatMap((offer) => (offer.intent === 'question' ? [offer.slotId] : []))
        .sort()

const opening = (session: Session) => {
    const pick = session.mapPick
    return pick ? mapPickOpening(pick, session.gameState) : undefined
}

/** Every site Dana can travel to from the Wood, as the engine lists them. */
const anySite = (session: Session) =>
    [...shroudedWoodDestinations(session.gameState, 'Dana', wood)].sort()

describe('R-11.7 — the Shrouded Wood ruler’s pick for the traveller’s own Travel is made on the map', () => {
    it('each lit site is priced as Dana pays there with the cards counted; the map pick is the ruler’s, opening on Dana’s region', async () => {
        const { session } = await rulerOfOwnTravel({}, [TENTS, FOREST_PATHS])
        expect(session.myPlayer?.id).toBe('Bea')
        const pick = session.question.travelPick
        expect(pick).toMatchObject({ moverId: 'Dana', ruler: true, free: false })
        const price = Object.fromEntries(
            (pick?.sites ?? []).map((site) => [site.siteId, [site.cost, site.foldedBy]])
        )
        expect(price).toEqual({
            [plains]: [0, [FOREST_PATHS]],
            [drownedCity]: [2, []],
            [greatSlum]: [0, [TENTS]],
            [river]: [0, [TENTS]],
            [hiddenPlace]: [0, [FOREST_PATHS]],
            [mountain]: [2, []],
            [wastes]: [2, []]
        })
        expect(offered(session)).toEqual(Object.keys(price).sort())
        expect(session.mapPick).toEqual({
            kind: 'ruler',
            sites: expect.arrayContaining(Object.keys(price)),
            choosing: true,
            moverId: 'Dana'
        })
        expect(opening(session)).toBe(Region.Provinces)
        const chips = (pick?.sites ?? []).map((site) => [site.siteId, pickChip(site)])
        expect(Object.fromEntries(chips)[river]).toEqual({ words: '0 Supply' })
        expect(Object.fromEntries(chips)[mountain]).toEqual({ words: '2 Supply' })
    })

    it('"Dana stays": the sites only the cards pay for are lit, and the stay is offered beside them', async () => {
        const { session } = await rulerOfOwnTravel(
            { supply: 1, favor: 1, advisers: [FOREST_PATHS] },
            [FOREST_PATHS]
        )
        expect(offered(session)).toEqual([plains, hiddenPlace].sort())
        expect(session.question.woodStayOffered).toBe(true)
        expect(session.mapPick?.kind).toBe('ruler')
    })

    it('one tap sends the pick', async () => {
        const { session, sent } = await rulerOfOwnTravel({}, [TENTS, FOREST_PATHS])
        await session.question.pickTravelSite(river)
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            siteId: river
        })
    })
})

describe('R-11.7-H1 — the ruler’s pick after a card or a banish moves the pawn is made on the map, free', () => {
    it('after the Whistle: any site Dana can travel to, free, with no chip; the map opens on Dana’s region', async () => {
        const { session } = await scene('whistle')
        expect(session.myPlayer?.id).toBe('Bea')
        expect(session.question.travelPick).toMatchObject({
            moverId: 'Dana',
            ruler: true,
            free: true
        })
        expect(offered(session)).toEqual(anySite(session))
        for (const site of session.question.travelPick?.sites ?? [])
            expect(pickChip(site)).toBeUndefined()
        expect(session.mapPick).toMatchObject({ kind: 'ruler', choosing: true, moverId: 'Dana' })
        expect(opening(session)).toBe(Region.Provinces)
    })

    it('after the Whistle used from another region, the map still opens on the moved pawn’s region, not the user’s', async () => {
        const { session } = await scene('whistleAway')
        expect(
            session.gameState.regionOf(session.gameState.getPlayerState('Ann').siteId ?? '')
        ).toBe(Region.Hinterland)
        expect(opening(session)).toBe(Region.Provinces)
    })

    it('Toll Roads on a free pick: the toll site’s chip is its toll alone', async () => {
        const { session } = await scene('whistleToll')
        const slum = session.question.travelPick?.sites.find((site) => site.siteId === greatSlum)
        expect(slum).toMatchObject({ cost: undefined, toll: true, flips: 0 })
        const chip = slum ? pickChip(slum) : undefined
        expect(chip).toEqual({ free: { toll: true, secrets: 0 } })
        expect(chip ? chipWords(chip) : undefined).toBe('toll 1 favor')
    })

    it('after the Brass Horse at the Wood: only the sites it allows', async () => {
        const { session } = await scene('horseWood')
        expect(session.myPlayer?.id).toBe('Bea')
        expect(offered(session)).toEqual([...HORSE_WOOD_SITES].sort())
        expect(session.question.travelPick).toMatchObject({
            moverId: 'Dana',
            ruler: true,
            free: true
        })
    })

    it('after Palanquin: the moved player’s pick, opening on their region', async () => {
        const { session } = await scene('palanquin')
        expect(session.myPlayer?.id).toBe('Bea')
        expect(session.gameState.getPlayerState('Ann').siteId).toBe(river)
        expect(session.question.travelPick).toMatchObject({
            moverId: 'Dana',
            ruler: true,
            free: true
        })
        expect(offered(session)).toEqual(anySite(session))
        expect(opening(session)).toBe(Region.Provinces)
    })

    it('after a banish: the defender’s pick, opening on their region', async () => {
        const { session } = await scene('banish')
        expect(session.myPlayer?.id).toBe('Bea')
        expect(session.question.travelPick).toMatchObject({
            moverId: 'Dana',
            ruler: true,
            free: true
        })
        expect(offered(session)).toEqual(anySite(session))
        expect(session.mapPick).toMatchObject({ kind: 'ruler', moverId: 'Dana' })
        expect(opening(session)).toBe(Region.Provinces)
    })

    it('one tap sends the pick', async () => {
        const { session, sent } = await scene('horseWood')
        await session.question.pickTravelSite(mountain)
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            siteId: mountain
        })
    })
})

describe('R-11.13-H1 — the Brass Horse user’s own pick is made on the map', () => {
    it('the Plains with no chip and The Hidden Place with "+[secret]"; the map opens on the first region with a lit site', async () => {
        const { session } = await scene('horseOwn')
        expect(session.myPlayer?.id).toBe('Dana')
        const pick = session.question.travelPick
        expect(pick).toMatchObject({ moverId: 'Dana', ruler: false, free: true })
        expect(offered(session)).toEqual([plains, hiddenPlace].sort())
        const hidden = pick?.sites.find((site) => site.siteId === hiddenPlace)
        const open = pick?.sites.find((site) => site.siteId === plains)
        expect(hidden ? pickChip(hidden) : undefined).toEqual({ free: { toll: false, secrets: 1 } })
        expect(open ? pickChip(open) : 'none').toBeUndefined()
        expect(session.mapPick).toMatchObject({ kind: 'travel', moverId: 'Dana' })
        expect(
            regionCounts(session.mapPick?.sites ?? [], (slotId) =>
                session.gameState.regionOf(slotId)
            ).find(({ region }) => region === Region.Provinces)?.count
        ).toBe(0)
        expect(opening(session)).toBe(Region.Cradle)
    })

    it('one tap on The Hidden Place sends the flip with the travel', async () => {
        const { session, sent } = await scene('horseOwn')
        await session.question.pickTravelSite(hiddenPlace)
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.TravelFreeTo,
            siteId: hiddenPlace,
            flipSecret: true
        })
        await session.question.pickTravelSite(plains)
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.TravelFreeTo,
            siteId: plains
        })
    })
})
