import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, HydratedSearchResolve, IMPERIAL_WARBANDS, MachineState, OathRevision, PlayerStatus, PowerChoiceKind, PowerTiming, SearchPlay, powerIndexOf, type LegalChoice } from '@tabletop/oath'
import { FIXTURE_SITE_CAPACITY, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    searchingTable,
    tableOf
} from '$lib/testing/sessionHarness.js'
import { emptyPicks } from './powerChoices.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

async function searching() {
    const session = await openSessionOn(searchingTable())
    return { session, draft: session.search }
}

/** The five cases `docs/user-interactions.md` requires of each staged flow, for the Search draft. */
describe('the Search draft (docs/user-interactions.md)', () => {
    it('keeping a card clears the placement chosen for the last one', async () => {
        const { draft } = await searching()
        const [first, second] = draft.drawn
        draft.keep(first)
        await draft.choosePlacement({ play: SearchPlay.Discard })
        expect(draft.placement).toEqual({ play: SearchPlay.Discard })

        draft.keep(second)
        expect(draft.kept).toBe(second)
        expect(draft.placement).toBeUndefined()
        expect(draft.tapped).toEqual([])
    })

    it('Undo pops the highest manual pick, and says so only while one is left', async () => {
        const { draft } = await searching()
        const [first] = draft.drawn
        draft.keep(first)
        await draft.choosePlacement({ play: SearchPlay.Discard })

        expect(draft.back()).toBe(true)
        expect(draft.placement).toBeUndefined()
        expect(draft.back()).toBe(true)
        expect(draft.kept).toBeUndefined()
        expect(draft.back()).toBe(false)
    })

    it('a Search has no auto pick: before any tap there is nothing for Undo to take', async () => {
        const { session, draft } = await searching()
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
        expect(session.hasManualDraft).toBe(false)
    })

    it('a card not drawn is never kept', async () => {
        const { draft } = await searching()
        draft.keep('denizen.order.not-drawn')
        expect(draft.kept).toBeUndefined()
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('reselecting the same card keeps nothing chosen under it', async () => {
        const { draft } = await searching()
        const [first] = draft.drawn
        draft.keep(first)
        await draft.choosePlacement({ play: SearchPlay.Discard })
        draft.keep(first)
        expect(draft.kept).toBe(first)
        expect(draft.placement).toBeUndefined()
    })
})

const ME = 'me'
const SALAD_DAYS = 'denizen.hearth.salad-days'
const TENTS = 'denizen.nomad.tents'
const TUTOR = 'denizen.arcane.tutor'
const HELD = ['denizen.order.longbows', 'denizen.hearth.wayside-inn', 'denizen.beast.wolves']

async function searchingWith(handIds: string[], advisers: string[] = [], table: Record<string, unknown> = {}) {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 2,
                handIds,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            })
        ],
        { machineState: MachineState.Searching, ...table }
    )
    openTurn(state, ME)
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    return { session, draft: session.search, sent }
}

describe('a Search play at the adviser limit (R-5.1.4.II)', () => {
    it('offers the adviser placement and asks which adviser makes room before sending', async () => {
        const { draft, sent } = await searchingWith([TENTS, TUTOR], HELD)
        draft.keep(TENTS)
        const faceup = draft.placements.find((o) => o.play === SearchPlay.Adviser && o.faceUp)
        expect(faceup).toBeDefined()
        expect(faceup?.room).toEqual({ needed: 1, discardable: HELD })

        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.needsDisplaced).toBe(true)
        expect(sent).not.toHaveBeenCalled()

        await draft.chooseDisplaced(HELD[2])
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({
                keptCardId: TENTS,
                play: SearchPlay.Adviser,
                faceUp: true,
                discardedAdviserCardIds: [HELD[2]]
            })
        )
    })

    it('Undo from the adviser pick returns to the placements', async () => {
        const { draft } = await searchingWith([TENTS, TUTOR], HELD)
        draft.keep(TENTS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.back()).toBe(true)
        expect(draft.placement).toBeUndefined()
        expect(draft.kept).toBe(TENTS)
    })
})

describe('a faceup Search play asks its When Played choices (R-7.3.3)', () => {
    it('Salad Days starts with no bank picked, and is sent only with three different banks', async () => {
        const { draft, sent } = await searchingWith([SALAD_DAYS, TUTOR])
        draft.keep(SALAD_DAYS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.needsWhenPlayed).toBe(true)
        expect(draft.whenPlayed).toHaveLength(3)

        expect(draft.whenPlayedComplete).toBe(false)
        await draft.confirmWhenPlayed()
        expect(sent).not.toHaveBeenCalled()

        draft.setPicks({ ...emptyPicks(), option: { 0: 0, 1: 0 } })
        expect(draft.whenPlayedComplete).toBe(false)
        draft.setPicks({ ...emptyPicks(), option: { 0: 0, 1: 0, 2: 0 } })
        expect(draft.whenPlayedComplete).toBe(true)
        expect(draft.whenPlayedReason).toMatch(/different/)
        await draft.confirmWhenPlayed()
        expect(sent).not.toHaveBeenCalled()

        draft.setPicks({ ...emptyPicks(), option: { 0: 0, 1: 1, 2: 2 } })
        expect(draft.whenPlayedReason).toBeUndefined()
        await draft.confirmWhenPlayed()
        const [sentChoice] = sent.mock.calls[0]
        const banks = (sentChoice.choices ?? []).map((c) =>
            c.kind === PowerChoiceKind.FavorBank ? c.suit : undefined
        )
        expect(new Set(banks).size).toBe(3)
    })

    it('a facedown play asks nothing', async () => {
        const { draft, sent } = await searchingWith([SALAD_DAYS, TUTOR])
        draft.keep(SALAD_DAYS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: false })
        expect(draft.needsWhenPlayed).toBe(false)
        expect(sent).toHaveBeenCalledWith(expect.not.objectContaining({ choices: expect.anything() }))
    })
})

describe('R-5.1.4.IV — the Conspiracy kept from a Search offers its take', () => {
    const CONSPIRACY = 'vision.conspiracy'
    const HEARTH = ['denizen.hearth.wayside-inn', 'denizen.hearth.awaited-return']
    const CUP = 'relic.cup-of-plenty'

    async function withRival(ann: Partial<Parameters<typeof testPlayer>[0]> = {}) {
        const state = testState(
            [
                testPlayer({
                    playerId: ME,
                    color: Color.Red,
                    siteId: 'c1',
                    secrets: 2,
                    handIds: [CONSPIRACY, TUTOR],
                    advisers: HEARTH.map((cardId) => ({ cardId, faceUp: true }))
                }),
                testPlayer({
                    playerId: 'ann',
                    color: Color.Blue,
                    siteId: 'c1',
                    relicIds: [CUP],
                    advisers: [{ cardId: 'denizen.hearth.salad-days', faceUp: true }],
                    ...ann
                })
            ],
            { machineState: MachineState.Searching }
        )
        openTurn(state, ME)
        const session = await openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
        return { draft: session.search, sent }
    }

    it('with no one to take from, the take step says why, and "Play" plays it with no take', async () => {
        const { draft, sent } = await withRival({ relicIds: [] })
        draft.keep(CONSPIRACY)
        await draft.choosePlacement({ play: SearchPlay.Conspiracy })
        expect(draft.needsConspiracy).toBe(true)
        expect(draft.conspiracyTargets).toEqual([])
        expect(draft.conspiracyNoTake).toEqual([
            {
                kind: 'words',
                parts: [
                    { kind: 'seat', playerId: 'ann', possessive: false },
                    { kind: 'text', text: ' holds no relic or banner.' }
                ]
            }
        ])
        expect(draft.conspiracyComplete).toBe(true)
        expect(sent).not.toHaveBeenCalled()

        await draft.confirmConspiracy()
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({ keptCardId: CONSPIRACY, play: SearchPlay.Conspiracy })
        )
        expect(sent).toHaveBeenCalledWith(
            expect.not.objectContaining({ conspiracy: expect.anything() })
        )
    })

    it('does not list a player who matches but holds nothing to take', async () => {
        const { draft } = await withRival({ relicIds: [] })
        draft.keep(CONSPIRACY)
        await draft.choosePlacement({ play: SearchPlay.Conspiracy })
        expect(draft.conspiracyTargets).toEqual([])
    })

    it('a player the take can reach is listed, and no line is said', async () => {
        const { draft } = await withRival()
        draft.keep(CONSPIRACY)
        await draft.choosePlacement({ play: SearchPlay.Conspiracy })
        expect(draft.conspiracyTargets).toEqual(['ann'])
        expect(draft.conspiracyNoTake).toEqual([])
    })

    it('Play is ready with nobody picked, not with a player alone, and again with a prize', async () => {
        const { draft, sent } = await withRival()
        draft.keep(CONSPIRACY)
        await draft.choosePlacement({ play: SearchPlay.Conspiracy })
        expect(draft.conspiracyComplete).toBe(true)

        draft.setConspiracyPick({ targetPlayerId: 'ann' })
        expect(draft.conspiracyComplete).toBe(false)
        await draft.confirmConspiracy()
        expect(sent).not.toHaveBeenCalled()

        draft.setConspiracyPick({ targetPlayerId: 'ann', prizeIndex: 0 })
        expect(draft.conspiracyComplete).toBe(true)
    })

    it('waits for the take, then sends it with the play', async () => {
        const { draft, sent } = await withRival()
        draft.keep(CONSPIRACY)
        await draft.choosePlacement({ play: SearchPlay.Conspiracy })
        expect(draft.needsConspiracy).toBe(true)
        expect(draft.conspiracyTargets).toEqual(['ann'])
        expect(sent).not.toHaveBeenCalled()

        draft.setConspiracyPick({ targetPlayerId: 'ann', prizeIndex: 0 })
        await draft.confirmConspiracy()
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({
                play: SearchPlay.Conspiracy,
                conspiracy: { targetPlayerId: 'ann', take: { kind: 'relic', cardId: CUP } }
            })
        )
    })
})

describe('Circlet of Command — the Conspiracy is not offered a relic it guards', () => {
    it("offers the Circlet itself and not the holder's other relics", async () => {
        const CIRCLET = 'relic.circlet-of-command'
        const state = testState(
            [
                testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', secrets: 2, handIds: ['vision.conspiracy', TUTOR], advisers: ['denizen.hearth.wayside-inn', 'denizen.hearth.awaited-return'].map((cardId) => ({ cardId, faceUp: true })) }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1', relicIds: [CIRCLET, 'relic.cup-of-plenty'], advisers: [{ cardId: 'denizen.hearth.salad-days', faceUp: true }] })
            ],
            { machineState: MachineState.Searching }
        )
        openTurn(state, ME)
        const draft = (await openSessionOn(tableOf(state))).search
        expect(draft.conspiracyPrizesOf('ann').map((option) => option.prize)).toEqual([{ kind: 'relic', cardId: CIRCLET }])
    })
})

describe("R-5.1.4.I — the People's Favor's holder is offered every site in their region", () => {
    it('lists a full site in the region, and the card there to discard first', async () => {
        const full = Array.from({ length: FIXTURE_SITE_CAPACITY }, (_, i) => `denizen.order.filler-${i}`)
        const state = testState([testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', handIds: [TENTS, TUTOR] })], {
            machineState: MachineState.Searching,
            denizensBySite: { c1: [], c2: full, p1: [] },
            banners: {
                [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: ME },
                [Banner.DarkestSecret]: { value: 1 }
            }
        })
        openTurn(state, ME)
        const draft = (await openSessionOn(tableOf(state))).search
        draft.keep(TENTS)
        expect(draft.otherSites).toContain('c2')
        expect(draft.otherSites).not.toContain('p1')
        draft.setToSite('c2')
        expect(draft.discardFirstOptions).toEqual(full)
    })
})

describe('R-7.6.4 — a limiter kept from a Search discards down to its limit', () => {
    it('asks for two advisers when Silver Tongue joins three, and sends both', async () => {
        const SILVER = 'denizen.discord.silver-tongue'
        const { draft, sent } = await searchingWith([SILVER, TUTOR], HELD)
        draft.keep(SILVER)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.room.needed).toBe(2)
        await draft.chooseDisplaced(HELD[0])
        expect(sent).not.toHaveBeenCalled()
        await draft.chooseDisplaced(HELD[1])
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ discardedAdviserCardIds: [HELD[0], HELD[1]] }))
    })
})

const LAND_WARDEN = 'denizen.hearth.land-warden'
const VISION = 'vision.conquest'
const WARDEN_CARRIED = { pendingSearchModifiers: [{ cardId: LAND_WARDEN, powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier) }] }

describe('Land Warden — the second play is picked on the cards', () => {
    it('a tap on a card picks its first way to play, a mode changes it, and a second tap drops it', async () => {
        const WRESTLERS = 'denizen.order.wrestlers'
        const { draft } = await searchingWith([TENTS, WRESTLERS, HELD[0]], [], WARDEN_CARRIED)
        draft.keep(TENTS)
        expect(draft.secondCandidates).toEqual([WRESTLERS, HELD[0]])

        draft.tapSecondCard(WRESTLERS)
        expect(draft.second).toMatchObject({ cardId: WRESTLERS, play: SearchPlay.Site, mode: 'to your site' })
        draft.setSecondPlay(draft.secondPlays.find((option) => option.cardId === WRESTLERS && option.faceUp === false)?.key)
        expect(draft.second?.mode).toBe('adviser, facedown')
        draft.tapSecondCard(HELD[0])
        expect(draft.second?.cardId).toBe(HELD[0])
        draft.tapSecondCard(HELD[0])
        expect(draft.second).toBeUndefined()
    })

    it('offers only the second plays the engine accepts: a Vision only as a facedown adviser, and none without the Warden', async () => {
        const { draft } = await searchingWith([TENTS, VISION], [], WARDEN_CARRIED)
        draft.keep(TENTS)
        expect(draft.secondPlays.map((option) => option.mode)).toEqual(['adviser, facedown'])

        const without = (await searchingWith([TENTS, VISION])).draft
        without.keep(TENTS)
        expect(without.secondPlays).toEqual([])
    })

    it('with a second adviser play, the kept card is offered only to the site', async () => {
        const { draft } = await searchingWith([TENTS, TUTOR], [], WARDEN_CARRIED)
        draft.keep(TENTS)
        draft.setSecondPlay(draft.secondPlays.find((option) => option.cardId === TUTOR && option.faceUp === false)?.key)
        expect(draft.placements.map((option) => option.play)).toEqual([SearchPlay.Site])
    })

    // Riots counts the map it resolves on: played second, after the kept card has landed at the site.
    describe("Riots as the second card is judged with the kept card's play before it, as the engine judges the pair", () => {
        const RIOTS = 'denizen.discord.riots'
        const MERCENARIES = 'denizen.discord.mercenaries'
        const SCRYER = 'denizen.discord.scryer'
        const STORYTELLER = 'denizen.hearth.storyteller'
        const riotsSecond = (draft: Awaited<ReturnType<typeof searchingWith>>['draft']) =>
            draft.secondPlays.find((option) => option.cardId === RIOTS && option.play === SearchPlay.Site)
        const onTheMob = (denizensBySite: Record<string, string[]>) => ({
            ...WARDEN_CARRIED,
            oathRevision: OathRevision.EngineFixes6,
            banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: true }, [Banner.DarkestSecret]: { value: 1 } },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizensBySite }
        })

        it('a kept Hearth card at the site would tie Hearth with Discord, which Riots played second cannot name, so the site is not offered', async () => {
            const { session, draft, sent } = await searchingWith([STORYTELLER, RIOTS, HELD[0]], [], onTheMob({ p1: [MERCENARIES], h1: [HELD[1]] }))
            draft.keep(STORYTELLER)
            draft.setSecondPlay(riotsSecond(draft)?.key)
            expect(draft.second?.cardId).toBe(RIOTS)
            expect(draft.placements.map((option) => option.play)).not.toContain(SearchPlay.Site)
            await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
            expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Adviser, secondPlay: { cardId: RIOTS, play: SearchPlay.Site } }))
            expect(engineRefusal(session, sent)).toBeUndefined()
        })

        it('a kept Discord card at the site breaks the tie, so Riots is offered second and only that placement pairs with it', async () => {
            const { session, draft, sent } = await searchingWith([SCRYER, RIOTS, HELD[0]], [], onTheMob({ p1: [MERCENARIES], h1: [HELD[1], STORYTELLER] }))
            draft.keep(SCRYER)
            draft.setSecondPlay(riotsSecond(draft)?.key)
            expect(draft.second?.cardId).toBe(RIOTS)
            expect(draft.placements.map((option) => option.play)).toEqual([SearchPlay.Site])
            await draft.choosePlacement({ play: SearchPlay.Site })
            expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Site, secondPlay: { cardId: RIOTS, play: SearchPlay.Site } }))
            expect(engineRefusal(session, sent)).toBeUndefined()
        })
    })
})

const FULL =Array.from({ length: FIXTURE_SITE_CAPACITY }, (_, i) => `denizen.order.filler-${i}`)
const FABLED_FEAST = 'denizen.hearth.fabled-feast'
const SLUM_SITES = { c1: 'site.great-slums', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
const FAVOR_HELD = {
    [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: ME },
    [Banner.DarkestSecret]: { value: 1 }
}

describe('contract rule 2 — a play the engine refuses is not offered', () => {
    it('a full site with nothing to open it offers no site play', async () => {
        const { draft } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: FULL, c2: [], p1: [] } })
        draft.keep(TENTS)
        expect(draft.placements.map((option) => option.play)).toEqual([
            SearchPlay.Adviser,
            SearchPlay.Adviser,
            SearchPlay.Discard
        ])
    })
})

/** The engine's own judgement of the Search as the draft sent it. */
function engineRefusal(session: Awaited<ReturnType<typeof searchingWith>>['session'], sent: Awaited<ReturnType<typeof searchingWith>>['sent']) {
    const [choice] = sent.mock.calls[0]
    return HydratedSearchResolve.reasonCannotResolve(session.gameState, ME, choice)
}

describe('R-5.1.4.I, R-11.10 — the site play is open when another site or a discard first opens it', () => {
    it("the People's Favor's holder at a full site plays to the open site picked in the region", async () => {
        const { session, draft, sent } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: FULL, c2: [], p1: [] }, banners: FAVOR_HELD })
        draft.keep(TENTS)
        expect(draft.otherSites).toEqual(['c2'])
        expect(draft.placements.map((option) => option.play)).toContain(SearchPlay.Site)
        draft.setToSite('c2')
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ keptCardId: TENTS, play: SearchPlay.Site, toSiteId: 'c2' }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('a full Great Slum takes the site play with a card discarded first', async () => {
        const { session, draft, sent } = await searchingWith([TENTS, TUTOR], [], { siteCards: SLUM_SITES, denizensBySite: { c1: FULL, c2: [], p1: [], h1: [] } })
        draft.keep(TENTS)
        expect(draft.otherSites).toEqual([])
        expect(draft.discardFirstOptions).toEqual(FULL)
        draft.setDiscardFirst(FULL[1])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Site, discardFirstCardId: FULL[1] }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('the site play picked with nothing that opens it is judged at send: not sent, one reason, gone with the next pick', async () => {
        const { draft, sent } = await searchingWith([TENTS, TUTOR], [], { siteCards: SLUM_SITES, denizensBySite: { c1: FULL, c2: [], p1: [], h1: [] } })
        draft.keep(TENTS)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).not.toHaveBeenCalled()
        expect(draft.placement).toBeUndefined()
        expect(draft.placementReason).toMatch(/capacity of 3/)

        draft.setDiscardFirst(FULL[0])
        expect(draft.placementReason).toBeUndefined()
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Site, discardFirstCardId: FULL[0] }))
    })

    it('a When Played card played to a full Great Slum is judged with its discard first', async () => {
        const { session, draft, sent } = await searchingWith([FABLED_FEAST, TUTOR], [], { siteCards: SLUM_SITES, denizensBySite: { c1: FULL, c2: [], p1: [], h1: [] } })
        draft.keep(FABLED_FEAST)
        draft.setDiscardFirst(FULL[2])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsWhenPlayed).toBe(true)
        // Its bank starts unpicked, so its Play waits for the pick.
        expect(draft.whenPlayedComplete).toBe(false)
        draft.setPicks({ ...emptyPicks(), option: { 0: 0 } })
        expect(draft.whenPlayedComplete).toBe(true)
        expect(draft.whenPlayedReason).toBeUndefined()
        await draft.confirmWhenPlayed()
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ keptCardId: FABLED_FEAST, play: SearchPlay.Site, discardFirstCardId: FULL[2] }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })
})

const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const NEW_GROWTH = 'denizen.beast.new-growth'
const INN = 'denizen.hearth.wayside-inn'
const carrying = (cardId: string) => ({ pendingSearchModifiers: [{ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) }] })
const FULL_ELSEWHERE = Array.from({ length: FIXTURE_SITE_CAPACITY }, (_, i) => `denizen.order.elsewhere-${i}`)

/** Each site play is judged on exactly what it sends: the site played to, the card discarded first, the Search's carried modifiers. */
describe('R-5.1.4.I, R-11.10, Crop Rotation, New Growth — the site play is judged on the play it sends', () => {
    it("the People's Favor's holder at their own full site plays there once a card there is discarded first", async () => {
        const { session, draft, sent } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: FULL, c2: FULL_ELSEWHERE, p1: [] }, banners: FAVOR_HELD })
        draft.keep(TENTS)
        expect(draft.placements.map((option) => option.play)).toContain(SearchPlay.Site)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).not.toHaveBeenCalled()
        expect(draft.placementReason).toMatch(/c1 is at its capacity of 3/)

        // A card discarded at another site frees no room here.
        expect(draft.discardFirstOptions).toEqual(FULL)
        draft.setDiscardFirst(FULL[1])
        expect(draft.placementReason).toBeUndefined()
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ keptCardId: TENTS, play: SearchPlay.Site, discardFirstCardId: FULL[1] }))
        expect(sent).toHaveBeenCalledWith(expect.not.objectContaining({ toSiteId: expect.anything() }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('the holder with room at their own site is refused another site that is full, until a card there is discarded first', async () => {
        const { session, draft, sent } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: [], c2: FULL, p1: [] }, banners: FAVOR_HELD })
        draft.keep(TENTS)
        draft.setToSite('c2')
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).not.toHaveBeenCalled()
        expect(draft.placement).toBeUndefined()
        expect(draft.placementReason).toMatch(/c2 is at its capacity of 3/)

        draft.setDiscardFirst(FULL[0])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Site, toSiteId: 'c2', discardFirstCardId: FULL[0] }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('Crop Rotation carried: a card discarded first opens a full site', async () => {
        const { session, draft, sent } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: FULL, c2: [], p1: [] }, ...carrying(CROP_ROTATION) })
        draft.keep(TENTS)
        expect(draft.otherSites).toEqual([])
        expect(draft.discardFirstOptions).toEqual(FULL)
        draft.setDiscardFirst(FULL[2])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Site, discardFirstCardId: FULL[2] }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('New Growth carried: a Hearth card plays to a site in another region; a Nomad card is offered no site play', async () => {
        const table = { denizensBySite: { c1: FULL, c2: [], p1: [] }, ...carrying(NEW_GROWTH) }
        const { session, draft, sent } = await searchingWith([INN, TUTOR], [], table)
        draft.keep(INN)
        expect(draft.otherSites).toContain('p1')
        draft.setToSite('p1')
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ keptCardId: INN, play: SearchPlay.Site, toSiteId: 'p1' }))
        expect(engineRefusal(session, sent)).toBeUndefined()

        const nomad = (await searchingWith([TENTS, TUTOR], [], table)).draft
        nomad.keep(TENTS)
        expect(nomad.otherSites).toEqual([])
        expect(nomad.placements.map((option) => option.play)).not.toContain(SearchPlay.Site)
    })

    it('New Growth carried: a full Great Slum played to opens with a card there discarded first', async () => {
        const { session, draft, sent } = await searchingWith([INN, TUTOR], [], {
            siteCards: { c1: 'c1', c2: 'c2', p1: 'site.great-slums', p2: 'p2', p3: 'p3', h1: 'h1', h2: 'h2', h3: 'h3' },
            denizensBySite: { c1: FULL, c2: [], p1: FULL_ELSEWHERE },
            ...carrying(NEW_GROWTH)
        })
        draft.keep(INN)
        expect(draft.otherSites).toContain('p1')
        draft.setToSite('p1')
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).not.toHaveBeenCalled()
        expect(draft.placementReason).toMatch(/p1 is at its capacity of 3/)

        expect(draft.discardFirstOptions).toEqual(FULL_ELSEWHERE)
        draft.setDiscardFirst(FULL_ELSEWHERE[0])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ play: SearchPlay.Site, toSiteId: 'p1', discardFirstCardId: FULL_ELSEWHERE[0] }))
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('a player with nothing that opens a full site is offered no card to discard first and no site play', async () => {
        const { draft, sent } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: FULL, c2: [], p1: [] } })
        draft.keep(TENTS)
        expect(draft.discardFirstOptions).toEqual([])
        expect(draft.otherSites).toEqual([])
        draft.setDiscardFirst(FULL[0])
        expect(draft.discardFirst).toBeUndefined()
        expect(draft.placements.map((option) => option.play)).not.toContain(SearchPlay.Site)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).not.toHaveBeenCalled()
    })

    it("Land Warden: the holder at their own full site pairs a facedown adviser with the site play a discard first opens", async () => {
        const { session, draft, sent } = await searchingWith([TENTS, TUTOR], [], { denizensBySite: { c1: FULL, c2: FULL_ELSEWHERE, p1: [] }, banners: FAVOR_HELD, ...WARDEN_CARRIED })
        draft.keep(TENTS)
        const facedown = draft.secondPlays.find((option) => option.cardId === TUTOR && option.faceUp === false)
        expect(facedown).toBeDefined()
        draft.setSecondPlay(facedown?.key)
        expect(draft.placements.map((option) => option.play)).toEqual([SearchPlay.Site])

        draft.setDiscardFirst(FULL[0])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({
                play: SearchPlay.Site,
                discardFirstCardId: FULL[0],
                secondPlay: { cardId: TUTOR, play: SearchPlay.Adviser, faceUp: false }
            })
        )
        expect(engineRefusal(session, sent)).toBeUndefined()
    })
})

const GREAT_HERD = 'denizen.nomad.great-herd'
const ORACLE = 'denizen.nomad.oracle'

/** The cards a When Played choice offers, in order. */
function cardTargets(choices: readonly LegalChoice[]): string[] {
    return choices.flatMap((legal) => legal.options.flatMap((option) => (option.kind === PowerChoiceKind.Card ? [option.cardId] : [])))
}

/** Contract rule 2: the card a site play discards first is no longer at a site, so Great Herd is not offered it. */
describe("R-5.1.4.I — Great Herd is not offered the card the People's Favor discards first", () => {
    const herdTable = { denizensBySite: { c1: [], c2: [TENTS], p1: [], h1: [ORACLE] }, banners: FAVOR_HELD }

    it('with Tents discarded first, only the Oracle is offered, and the play is sent with it', async () => {
        const { session, draft, sent } = await searchingWith([GREAT_HERD, TUTOR], [], herdTable)
        draft.keep(GREAT_HERD)
        expect(draft.discardFirstOptions).toContain(TENTS)
        draft.setDiscardFirst(TENTS)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsWhenPlayed).toBe(true)
        expect(cardTargets(draft.whenPlayed)).toEqual([ORACLE])

        draft.setPicks({ ...emptyPicks(), option: { 0: 0 } })
        expect(draft.whenPlayedReason).toBeUndefined()
        await draft.confirmWhenPlayed()
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({ keptCardId: GREAT_HERD, discardFirstCardId: TENTS, choices: [{ kind: PowerChoiceKind.Card, cardId: ORACLE }] })
        )
        expect(engineRefusal(session, sent)).toBeUndefined()
    })

    it('with nothing discarded first, Tents is offered as before', async () => {
        const { draft } = await searchingWith([GREAT_HERD, TUTOR], [], herdTable)
        draft.keep(GREAT_HERD)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(cardTargets(draft.whenPlayed)).toEqual([TENTS, ORACLE])
    })

    it('a pick of Tents made before Tents is picked to go first is dropped with it', async () => {
        const { draft } = await searchingWith([GREAT_HERD, TUTOR], [], herdTable)
        draft.keep(GREAT_HERD)
        await draft.choosePlacement({ play: SearchPlay.Site })
        draft.setPicks({ ...emptyPicks(), option: { 0: cardTargets(draft.whenPlayed).indexOf(TENTS) } })
        expect(draft.picks.option).toEqual({ 0: 0 })

        draft.setDiscardFirst(TENTS)
        expect(draft.picks).toEqual(emptyPicks())
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(cardTargets(draft.whenPlayed)).toEqual([ORACLE])
        expect(draft.picks).toEqual(emptyPicks())
    })
})

describe("R-7.3.3 — Bewitch's yes is offered once the play's own secret counts", () => {
    const BEWITCH = 'denizen.arcane.bewitch'

    /** The seat, an Exile with 2 secrets, searches at Standing Stones (the Arcane Homeland: a secret); the Chancellor holds 2. */
    function bewitching(oathRevision: OathRevision) {
        const state = testState(
            [
                testPlayer({ playerId: ME, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 2, secrets: 2, handIds: [BEWITCH, TUTOR] }),
                testPlayer({ playerId: 'ann', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', secrets: 2, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } })
            ],
            {
                machineState: MachineState.Searching,
                oathRevision,
                chancellorPlayerId: 'ann',
                denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
                siteCards: { c1: 'site.standing-stones', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
            }
        )
        openTurn(state, ME)
        const session = openSessionOn(tableOf(state))
        vi.spyOn(session, 'resolveSearch').mockResolvedValue()
        return session.search
    }

    it('from revision 16, the site play asks the yes, and the engine accepts it', async () => {
        const draft = bewitching(OathRevision.EngineFixes12)
        draft.keep(BEWITCH)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.whenPlayed.map((legal) => legal.options)).toEqual([[{ kind: PowerChoiceKind.Yes }]])
        draft.setPicks({ ...emptyPicks(), option: { 0: 0 } })
        expect(draft.whenPlayedReason).toBeUndefined()
    })

    it('before revision 16, 2 against 2 leaves nothing to ask', async () => {
        const draft = bewitching(OathRevision.EngineFixes11)
        draft.keep(BEWITCH)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.whenPlayed).toEqual([])
    })
})
