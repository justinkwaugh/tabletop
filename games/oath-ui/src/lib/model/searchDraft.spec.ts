import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, MachineState, PowerChoiceKind, PowerTiming, SearchPlay, powerIndexOf } from '@tabletop/oath'
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

function searching() {
    const session = openSessionOn(searchingTable())
    return { session, draft: session.search }
}

/** The five cases `docs/user-interactions.md` requires of each staged flow, for the Search draft. */
describe('the Search draft (docs/user-interactions.md)', () => {
    it('keeping a card clears the placement chosen for the last one', async () => {
        const { draft } = searching()
        const [first, second] = draft.drawn
        draft.keep(first)
        await draft.choosePlacement({ play: SearchPlay.Discard })
        expect(draft.placement).toEqual({ play: SearchPlay.Discard })

        draft.keep(second)
        expect(draft.kept).toBe(second)
        expect(draft.placement).toBeUndefined()
        expect(draft.tapped).toEqual([])
    })

    it('Back pops the highest manual pick, and says so only while one is left', async () => {
        const { draft } = searching()
        const [first] = draft.drawn
        draft.keep(first)
        await draft.choosePlacement({ play: SearchPlay.Discard })

        expect(draft.back()).toBe(true)
        expect(draft.placement).toBeUndefined()
        expect(draft.back()).toBe(true)
        expect(draft.kept).toBeUndefined()
        expect(draft.back()).toBe(false)
    })

    it('a Search has no auto pick: before any tap there is nothing for Back or Undo to take', () => {
        const { session, draft } = searching()
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
        expect(session.hasManualDraft).toBe(false)
    })

    it('a card not drawn is never kept', () => {
        const { draft } = searching()
        draft.keep('denizen.order.not-drawn')
        expect(draft.kept).toBeUndefined()
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('reselecting the same card keeps nothing chosen under it', async () => {
        const { draft } = searching()
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

function searchingWith(handIds: string[], advisers: string[] = [], table: Record<string, unknown> = {}) {
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
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    return { session, draft: session.search, sent }
}

describe('a Search play at the adviser limit (R-5.1.4.II)', () => {
    it('offers the adviser placement and asks which adviser makes room before sending', async () => {
        const { draft, sent } = searchingWith([TENTS, TUTOR], HELD)
        draft.keep(TENTS)
        const faceup = draft.placements.find((o) => o.play === SearchPlay.Adviser && o.faceUp)
        expect(faceup?.blockedBecause).toBeUndefined()
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

    it('Back from the adviser pick returns to the placements', async () => {
        const { draft } = searchingWith([TENTS, TUTOR], HELD)
        draft.keep(TENTS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.back()).toBe(true)
        expect(draft.placement).toBeUndefined()
        expect(draft.kept).toBe(TENTS)
    })
})

describe('a faceup Search play asks its When Played choices (R-7.3.3)', () => {
    it('Salad Days is sent only with three different banks', async () => {
        const { draft, sent } = searchingWith([SALAD_DAYS, TUTOR])
        draft.keep(SALAD_DAYS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.needsWhenPlayed).toBe(true)
        expect(draft.whenPlayed).toHaveLength(3)

        await draft.confirmWhenPlayed()
        expect(draft.whenPlayedReason).toMatch(/different/)
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
        const { draft, sent } = searchingWith([SALAD_DAYS, TUTOR])
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

    function withRival() {
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
                    advisers: [{ cardId: 'denizen.hearth.salad-days', faceUp: true }]
                })
            ],
            { machineState: MachineState.Searching }
        )
        openTurn(state, ME)
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
        return { draft: session.search, sent }
    }

    it('waits for the take, then sends it with the play', async () => {
        const { draft, sent } = withRival()
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
    it("offers the Circlet itself and not the holder's other relics", () => {
        const CIRCLET = 'relic.circlet-of-command'
        const state = testState(
            [
                testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', secrets: 2, handIds: ['vision.conspiracy', TUTOR], advisers: ['denizen.hearth.wayside-inn', 'denizen.hearth.awaited-return'].map((cardId) => ({ cardId, faceUp: true })) }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1', relicIds: [CIRCLET, 'relic.cup-of-plenty'], advisers: [{ cardId: 'denizen.hearth.salad-days', faceUp: true }] })
            ],
            { machineState: MachineState.Searching }
        )
        openTurn(state, ME)
        const draft = openSessionOn(tableOf(state)).search
        expect(draft.conspiracyPrizesOf('ann').map((option) => option.prize)).toEqual([{ kind: 'relic', cardId: CIRCLET }])
    })
})

describe("R-5.1.4.I — the People's Favor's holder is offered every site in their region", () => {
    it('lists a full site in the region, and the card there to discard first', () => {
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
        const draft = openSessionOn(tableOf(state)).search
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
        const { draft, sent } = searchingWith([SILVER, TUTOR], HELD)
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
    it('a tap on a card picks its first way to play, a mode changes it, and a second tap drops it', () => {
        const WRESTLERS = 'denizen.order.wrestlers'
        const { draft } = searchingWith([TENTS, WRESTLERS, HELD[0]], [], WARDEN_CARRIED)
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

    it('offers only the second plays the engine accepts: a Vision only as a facedown adviser, and none without the Warden', () => {
        const { draft } = searchingWith([TENTS, VISION], [], WARDEN_CARRIED)
        draft.keep(TENTS)
        expect(draft.secondPlays.map((option) => option.mode)).toEqual(['adviser, facedown'])

        const without = searchingWith([TENTS, VISION]).draft
        without.keep(TENTS)
        expect(without.secondPlays).toEqual([])
    })

    it('with a second adviser play, the kept card is offered only to the site', () => {
        const { draft } = searchingWith([TENTS, TUTOR], [], WARDEN_CARRIED)
        draft.keep(TENTS)
        draft.setSecondPlay(draft.secondPlays.find((option) => option.cardId === TUTOR && option.faceUp === false)?.key)
        const open = draft.placements.filter((option) => option.blockedBecause === undefined)
        expect(open.map((option) => option.play)).toEqual([SearchPlay.Site])
        expect(draft.placements.find((option) => option.play === SearchPlay.Adviser)?.blockedBecause).toMatch(/at least one of the two cards/)
    })
})
