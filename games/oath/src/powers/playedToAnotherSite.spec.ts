import { describe, expect, it } from 'vitest'
import type { Visibility } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind } from '../model/question.js'
import { OathVisibility } from '../definition/runtime.js'
import { testBanners } from '../testing/fixture.js'
import { rulerTable } from '../testing/tables.js'
import { buildAction } from '../testing/actions.js'
import { answerQuestion } from '../testing/steps.js'
import { FILLER, INN } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { reasonCannotPlaceCard } from '../util/cardPlay.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// R-5.1.4.I: the People's Favor's holder "may play this card to any site in your region". A card whose text says
// "this site" acts at the site it is played to.

const SALT = 'denizen.discord.salt-the-earth'
const GATHERING = 'denizen.nomad.the-gathering'
const WOLVES = 'denizen.beast.wolves'
const STORYTELLER = 'denizen.hearth.storyteller'
const LOCKED = 'denizen.beast.vow-of-union'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'

const NOW = OathRevision.EngineFixes12
const BEFORE = OathRevision.EngineFixes11

/**
 * 'ruler' holds the People's Favor at c1 (the Plains, room for 3) and rules c2 (the River, room for 2), in the
 * same region; 'other' is at c1 too; 'away', the Chancellor, at h1.
 */
function table(
    revision: OathRevision,
    c1: string[],
    c2: string[],
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {}
) {
    return rulerTable(
        c1,
        [],
        { away: { status: PlayerStatus.Chancellor }, ...over },
        {
            oathRevision: revision,
            chancellorPlayerId: 'away',
            denizensBySite: { c1, c2, p1: [], h1: [] },
            banners: testBanners({ [Banner.PeoplesFavor]: 'ruler' }),
            ...state
        }
    )
}

const placeSalt = (s: HydratedOathGameState, toSiteId?: string) =>
    reasonCannotPlaceCard(s, 'ruler', SALT, SearchPlay.Site, { toSiteId })

function playTo(s: HydratedOathGameState, cardId: string, toSiteId: string) {
    s.getPlayerState('ruler').handIds = [cardId, FILLER]
    const data = {
        playerId: 'ruler',
        keptCardId: cardId,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        toSiteId
    }
    expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', data)).toBeUndefined()
    const action = new HydratedSearchResolve(buildAction(SearchResolve, data))
    action.apply(s)
    return action
}

describe('Salt the Earth played to another site acts at that site', () => {
    it("clears the site it was played to and caps it at 1; its player's own site keeps its cards", () => {
        const s = table(NOW, [INN], [WOLVES])
        const action = playTo(s, SALT, 'c2')
        expect(s.denizensBySite['c2']).toEqual([SALT])
        expect(s.denizensBySite['c1']).toEqual([INN])
        expect(s.siteCapacityOverrides).toEqual({ c2: 1 })
        expect(effectiveSiteCapacity(s, 'c2')).toBe(1)
        expect(action.metadata?.whenPlayed).toBe(
            'Salt the Earth: discarded 1 denizens at c2; its capacity is now 1'
        )
    })

    it("ignores that site's capacity: a full site is accepted, and cleared", () => {
        const s = table(NOW, [INN], [WOLVES, STORYTELLER])
        expect(effectiveSiteCapacity(s, 'c2')).toBe(2)
        expect(placeSalt(s, 'c2')).toBeUndefined()
        playTo(s, SALT, 'c2')
        expect(s.denizensBySite['c2']).toEqual([SALT])
    })

    it('a locked card at that site bars it', () => {
        expect(placeSalt(table(NOW, [INN], [LOCKED]), 'c2')).toBe(
            'Salt the Earth cannot be played to a site with any locked cards'
        )
    })

    it("a card Ancient Bloodline locks there bars it: another player's denizens at a site they rule (R-7.2.2)", () => {
        const s = table(
            NOW,
            [INN],
            [WOLVES],
            { other: { advisers: [{ cardId: BLOODLINE, faceUp: true }] } },
            {
                warbandsBySite: { c1: { ruler: 1 }, c2: { other: 2 }, p1: { other: 3 } }
            }
        )
        expect(placeSalt(s, 'c2')).toBe(
            'Salt the Earth cannot be played to a site with any locked cards'
        )
    })

    it("a locked card at its player's own site does not bar a play to another site", () => {
        const s = table(NOW, [INN, LOCKED], [WOLVES])
        expect(placeSalt(s, 'c1')).toBe(
            'Salt the Earth cannot be played to a site with any locked cards'
        )
        expect(placeSalt(s, 'c2')).toBeUndefined()
        playTo(s, SALT, 'c2')
        expect(s.denizensBySite).toMatchObject({ c1: [INN, LOCKED], c2: [SALT] })
    })

    it("still needs the People's Favor, or New Growth, to go to another site", () => {
        const s = table(NOW, [INN], [WOLVES], {}, { banners: testBanners() })
        expect(placeSalt(s, 'c2')).toBe(`${SALT} can only be played to your own site`)
    })

    it('a facedown Salt the Earth played faceup (R-6.1) to a full site elsewhere is accepted, and clears it', () => {
        const s = table(NOW, [INN], [WOLVES, STORYTELLER], {
            ruler: { advisers: [{ cardId: SALT, faceUp: false }] }
        })
        const choice = { cardId: SALT, play: SearchPlay.Site, toSiteId: 'c2' }
        expect(HydratedPlayFacedownAdviser.reasonCannotPlace(s, 'ruler', choice)).toBeUndefined()
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'ruler', choice)).toBeUndefined()
        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: 'ruler', ...choice })
        ).apply(s)
        expect(s.denizensBySite).toMatchObject({ c1: [INN], c2: [SALT] })
        expect(s.siteCapacityOverrides).toEqual({ c2: 1 })
    })

    it("R-X.4 — before revision 16, a play to another site is judged as any other card, and clears its player's site", () => {
        expect(placeSalt(table(BEFORE, [INN], [WOLVES, STORYTELLER]), 'c2')).toBe(
            'site c2 is at its capacity of 2'
        )
        expect(placeSalt(table(BEFORE, [INN], [LOCKED]), 'c2')).toBeUndefined()
        const s = table(BEFORE, [INN, LOCKED], [WOLVES])
        playTo(s, SALT, 'c2')
        expect(s.denizensBySite).toMatchObject({ c1: [LOCKED], c2: [WOLVES, SALT] })
        expect(s.siteCapacityOverrides).toEqual({ c1: 1 })
    })
})

const joinQuestions = (s: HydratedOathGameState) =>
    (s.pendingQuestions?.queue ?? []).map((q) => [
        q.askedPlayerId,
        q.kind === PowerQuestionKind.JoinSite ? q.siteId : undefined
    ])

describe('The Gathering played to another site gathers there (R-7.6.3-H3)', () => {
    it('asks every player whose pawn is elsewhere, its own player included, in turn order from the Chancellor', () => {
        const s = table(NOW, [], [])
        playTo(s, GATHERING, 'c2')
        expect(s.denizensBySite['c2']).toEqual([GATHERING])
        expect(joinQuestions(s)).toEqual([
            ['away', 'c2'],
            ['ruler', 'c2'],
            ['other', 'c2']
        ])
        expect(s.pendingQuestions?.followUp).toMatchObject({ kind: 'gatheringFloor', siteId: 'c2' })
        answerQuestion(s, 'away', { kind: PowerQuestionKind.JoinSite, join: false })
        answerQuestion(s, 'ruler', { kind: PowerQuestionKind.JoinSite, join: true })
        expect(s.getPlayerState('ruler').siteId).toBe('c2')
    })

    it('played to its own site, its player is not asked, as before', () => {
        const s = table(NOW, [], [])
        playTo(s, GATHERING, 'c1')
        expect(joinQuestions(s)).toEqual([['away', 'c1']])
    })

    it("R-X.4 — before revision 16, it gathers at its player's site, and never asks its player", () => {
        const s = table(BEFORE, [], [])
        playTo(s, GATHERING, 'c2')
        expect(joinQuestions(s)).toEqual([['away', 'c1']])
        expect(s.pendingQuestions?.followUp).toMatchObject({ siteId: 'c1' })
    })
})

describe("Salt the Earth's card discarded first is judged as any site play's (R-5.1.4.I, R-11.10)", () => {
    const noFavor = { banners: testBanners() }
    const firstWolves = { discardFirstCardId: WOLVES }

    function search(s: HydratedOathGameState, extra: Partial<SearchResolve> = {}) {
        s.getPlayerState('ruler').handIds = [SALT, FILLER]
        return {
            playerId: 'ruler',
            keptCardId: SALT,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            ...extra
        }
    }

    it("without the People's Favor, the Great Slum or Crop Rotation, a card at another site is refused, on the Search and on a facedown adviser's play", () => {
        const s = table(
            NOW,
            [INN],
            [WOLVES],
            { ruler: { advisers: [{ cardId: SALT, faceUp: false }] } },
            noFavor
        )
        const refusal =
            "only the Great Slum, Crop Rotation, or holding the People's Favor, lets a card be discarded first"
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', search(s, firstWolves))).toBe(
            refusal
        )
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'ruler', {
                cardId: SALT,
                play: SearchPlay.Site,
                ...firstWolves
            })
        ).toBe(refusal)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlace(s, 'ruler', {
                cardId: SALT,
                play: SearchPlay.Site,
                ...firstWolves
            })
        ).toBe(refusal)
        expect(s.denizensBySite['c2']).toEqual([WOLVES])
    })

    it("with the People's Favor, a card at another site in its holder's region is discarded first", () => {
        const s = table(NOW, [INN], [WOLVES])
        const data = search(s, firstWolves)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', data)).toBeUndefined()
        new HydratedSearchResolve(buildAction(SearchResolve, data)).apply(s)
        expect(s.denizensBySite).toMatchObject({ c1: [SALT], c2: [] })
    })

    it("with the People's Favor, a card outside its holder's region is refused", () => {
        const s = table(
            NOW,
            [INN],
            [],
            {},
            { denizensBySite: { c1: [INN], c2: [], p1: [WOLVES], h1: [] } }
        )
        expect(
            HydratedSearchResolve.reasonCannotResolve(s, 'ruler', search(s, firstWolves))
        ).toMatch(/lets a card be discarded first/)
    })

    it('R-X.4 — before revision 16, Salt the Earth to its own site leaves the card unchecked, so it is discarded', () => {
        const s = table(BEFORE, [INN], [WOLVES], {}, noFavor)
        const data = search(s, firstWolves)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', data)).toBeUndefined()
        new HydratedSearchResolve(buildAction(SearchResolve, data)).apply(s)
        expect(s.denizensBySite).toMatchObject({ c1: [SALT], c2: [] })
    })
})

describe("on the player's own view, where another player's facedown adviser and the vault cannot be read", () => {
    const ruler: Visibility.Perspective = { kind: 'player', playerId: 'ruler' }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, ruler)), ruler)

    /** The same answer on the server and on the player's view, and neither changes the state or what they are served. */
    function sameOnOwnView<T>(
        s: HydratedOathGameState,
        check: (state: HydratedOathGameState) => T,
        expected: T
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, ruler))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, ruler))).toBe(seen)
    }

    it("Salt the Earth's play to a full site, to a locked one, to one Ancient Bloodline locks, and with a card discarded first", () => {
        const hidden = { other: { advisers: [{ cardId: STORYTELLER, faceUp: false }] } }
        sameOnOwnView(
            table(NOW, [INN], [WOLVES, 'denizen.beast.rangers'], hidden),
            (v) => placeSalt(v, 'c2'),
            undefined
        )
        sameOnOwnView(
            table(NOW, [INN], [LOCKED], hidden),
            (v) => placeSalt(v, 'c2'),
            'Salt the Earth cannot be played to a site with any locked cards'
        )
        const bloodline = table(
            NOW,
            [INN],
            [WOLVES],
            {
                other: {
                    advisers: [
                        { cardId: BLOODLINE, faceUp: true },
                        { cardId: STORYTELLER, faceUp: false }
                    ]
                }
            },
            {
                warbandsBySite: { c1: { ruler: 1 }, c2: { other: 2 }, p1: { other: 3 } }
            }
        )
        sameOnOwnView(
            bloodline,
            (v) => placeSalt(v, 'c2'),
            'Salt the Earth cannot be played to a site with any locked cards'
        )
        const elsewhere = table(NOW, [INN], [WOLVES], hidden, { banners: testBanners() })
        sameOnOwnView(
            elsewhere,
            (v) =>
                reasonCannotPlaceCard(v, 'ruler', SALT, SearchPlay.Site, {
                    discardFirstCardId: WOLVES
                }),
            "only the Great Slum, Crop Rotation, or holding the People's Favor, lets a card be discarded first"
        )
    })
})
