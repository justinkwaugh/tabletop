import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testBanners, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { bank, modifierUse } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { favorShortOf, playMapChanges, sitePlayGain, type CardPlayOptions } from './cardPlay.js'
import { searchPlayModifiers } from './modifiers.js'
import { OathRevision } from './revision.js'
import '../powers/index.js'

// R-5.1.4.I "gain 1 favor from the bank matching its suit", R-11.2 a Homeland's, R-7.4 Welcoming Party's: what a
// site play gains, planned on the banks as they stand, and the banks that came up short (R-9.3), as recorded.

const WOLVES = 'denizen.beast.wolves'
const WELCOMING = 'denizen.hearth.welcoming-party'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const FEAST = 'denizen.hearth.fabled-feast'
const VOW = 'denizen.nomad.vow-of-kinship'
const BOOK = 'relic.book-of-records'
const VALLEY = 'site.fertile-valley'

type Seats = { dana?: Partial<OathPlayerState>; ann?: Partial<OathPlayerState> }

/** Dana, an Exile, at c1 (the Plains unless a site is named), which they rule; Ann, the Chancellor, at h1. */
function board(
    banks: Partial<Record<Suit, number>>,
    seats: Seats = {},
    table: Record<string, unknown> = {}
) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                supply: 5,
                warbandsOnBoard: { dana: 4 },
                ...seats.dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 2,
                supply: 5,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                ...seats.ann
            })
        ],
        {
            oathRevision: OathRevision.EngineFixes12,
            chancellorPlayerId: 'ann',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 }, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...table
        }
    )
    for (const suit of Object.values(Suit)) s.favorBank[suit] = banks[suit] ?? 0
    openTurn(s, 'dana')
    return s
}

const atValley = {
    siteCards: { c1: VALLEY, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
}
const carrying = (...cardIds: string[]) => ({
    pendingSearchModifiers: cardIds.map((cardId) => ({
        cardId,
        powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
    }))
})

/** The Search's site play as the menu plans it: with the Search's carried modifiers. */
function planned(s: HydratedOathGameState, cardId: string, options: CardPlayOptions = {}) {
    return sitePlayGain(
        playMapChanges(s, 'dana', cardId, SearchPlay.Site, {
            carried: searchPlayModifiers(s),
            ...options
        })
    )
}

function resolveSearch(
    s: HydratedOathGameState,
    cardId: string,
    extra: Partial<SearchResolve> = {},
    hand: string[] = [cardId, FILLER]
) {
    s.getPlayerState('dana').handIds = hand
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId: 'dana',
            keptCardId: cardId,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            ...extra
        })
    )
    action.apply(s)
    return action
}

/** The favor and secrets Dana holds, which the play's gains add to. */
const held = (s: HydratedOathGameState) => {
    const dana = s.getPlayerState('dana')
    return { favor: dana.favor, secrets: dana.secrets + dana.secretsFacedown }
}

describe('a site play gains, as planned and as played', () => {
    const cases: Array<
        [string, () => HydratedOathGameState, string, { favor: number; secrets: number }]
    > = [
        [
            "the site's 1 favor (Wolves, Beast 2)",
            () => board({ [Suit.Beast]: 2 }),
            WOLVES,
            { favor: 1, secrets: 0 }
        ],
        [
            'an empty bank (Wolves, Beast 0)',
            () => board({ [Suit.Hearth]: 3 }),
            WOLVES,
            { favor: 0, secrets: 0 }
        ],
        [
            'Fertile Valley with Hearth 3: the site and the Homeland',
            () => board({ [Suit.Hearth]: 3 }, {}, atValley),
            INN,
            { favor: 2, secrets: 0 }
        ],
        [
            'Fertile Valley with Hearth 1: the site takes the last',
            () => board({ [Suit.Hearth]: 1 }, {}, atValley),
            INN,
            { favor: 1, secrets: 0 }
        ],
        [
            'Fertile Valley with Hearth 0',
            () => board({}, {}, atValley),
            INN,
            { favor: 0, secrets: 0 }
        ],
        [
            'Welcoming Party carried: the site and the Hearth favor after',
            () => board({ [Suit.Beast]: 2, [Suit.Hearth]: 3 }, {}, carrying(WELCOMING)),
            WOLVES,
            { favor: 2, secrets: 0 }
        ],
        [
            'Welcoming Party carried, Beast empty: the Hearth favor only',
            () => board({ [Suit.Hearth]: 3 }, {}, carrying(WELCOMING)),
            WOLVES,
            { favor: 1, secrets: 0 }
        ],
        [
            'Welcoming Party carried, Hearth 1 and a Hearth card: the site takes it first',
            () => board({ [Suit.Hearth]: 1 }, {}, carrying(WELCOMING)),
            INN,
            { favor: 1, secrets: 0 }
        ],
        [
            'Book of Records carried: a secret, not the favor',
            () => board({ [Suit.Beast]: 2 }, { dana: { relicIds: [BOOK] } }, carrying(BOOK)),
            WOLVES,
            { favor: 0, secrets: 1 }
        ],
        [
            'Book of Records at Fertile Valley: the secret, and the Homeland still pays',
            () =>
                board(
                    { [Suit.Hearth]: 3 },
                    { dana: { relicIds: [BOOK] } },
                    { ...atValley, ...carrying(BOOK) }
                ),
            INN,
            { favor: 1, secrets: 1 }
        ]
    ]

    it.each(cases)('%s', (_, setup, cardId, expected) => {
        const s = setup()
        expect(planned(s, cardId)).toEqual(expected)
        const before = held(s)
        resolveSearch(s, cardId)
        const after = held(s)
        expect({
            favor: after.favor - before.favor,
            secrets: after.secrets - before.secrets
        }).toEqual(expected)
    })

    it("Vow of Kinship: a Nomad card takes the Nomad bank's favor, which stays in the Nomad bank", () => {
        const s = board(
            { [Suit.Nomad]: 1 },
            { dana: { advisers: [{ cardId: VOW, faceUp: true }] } }
        )
        expect(planned(s, TENTS)).toEqual({ favor: 1, secrets: 0 })
        expect(resolveSearch(s, TENTS).metadata?.favorGained).toBe(1)
    })

    it("a card discarded first gives its favor back before the site takes one from the same bank (the People's Favor)", () => {
        const s = board({}, {}, { banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }) })
        s.denizensBySite['c2'] = ['denizen.hearth.storyteller']
        s.addTokensOn('denizen.hearth.storyteller', { favor: 1 })
        expect(planned(s, INN, { discardFirstCardId: 'denizen.hearth.storyteller' })).toEqual({
            favor: 1,
            secrets: 0
        })
        expect(
            resolveSearch(s, INN, { discardFirstCardId: 'denizen.hearth.storyteller' }).metadata
                ?.favorGained
        ).toBe(1)
    })

    it('a facedown adviser played faceup to the site (R-6.1): the same gains; Welcoming Party does not act on it', () => {
        const s = board(
            { [Suit.Hearth]: 3 },
            {
                dana: {
                    advisers: [
                        { cardId: INN, faceUp: false },
                        { cardId: WELCOMING, faceUp: true }
                    ]
                }
            },
            atValley
        )
        const choice = { cardId: INN, play: SearchPlay.Site }
        expect(sitePlayGain(HydratedPlayFacedownAdviser.playMapChanges(s, 'dana', choice))).toEqual(
            { favor: 2, secrets: 0 }
        )
        const declared = { ...choice, modifiers: [modifierUse(WELCOMING)] }
        expect(HydratedPlayFacedownAdviser.reasonCannotPlace(s, 'dana', declared)).toMatch(
            /facedown adviser/
        )
        expect(
            sitePlayGain(HydratedPlayFacedownAdviser.playMapChanges(s, 'dana', declared))
        ).toEqual({ favor: 2, secrets: 0 })
    })

    it('a play to no site gains nothing here; one to another site is planned there', () => {
        const s = board(
            { [Suit.Beast]: 2 },
            {},
            { banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }) }
        )
        expect(
            sitePlayGain(playMapChanges(s, 'dana', WOLVES, SearchPlay.Adviser, { faceUp: true }))
        ).toBeUndefined()
        const there = playMapChanges(s, 'dana', WOLVES, SearchPlay.Site, { toSiteId: 'c2' })
        expect(there.siteId).toBe('c2')
        expect(sitePlayGain(there)).toEqual({ favor: 1, secrets: 0 })
    })

    it("Land Warden's second card plans only its own favor, and no Welcoming Party favor again (R-7.4.2)", () => {
        const s = board({ [Suit.Beast]: 2, [Suit.Hearth]: 3 }, {}, carrying(WELCOMING))
        const kept = playMapChanges(s, 'dana', WOLVES, SearchPlay.Site, {
            carried: searchPlayModifiers(s)
        })
        const second = playMapChanges(s, 'dana', INN, SearchPlay.Site, {
            carried: searchPlayModifiers(s),
            earlierMapChanges: kept
        })
        expect(kept.gains?.favorTaken).toEqual([{ suit: Suit.Beast, gained: 1 }])
        expect(kept.gains?.favorAfter).toBe(1)
        expect(second.gains?.favorTaken).toEqual([{ suit: Suit.Hearth, gained: 1 }])
        expect(second.gains?.favorAfter).toBe(0)
    })
})

describe('the banks that came up short, as the play records them (R-9.3)', () => {
    it('each bank once, empty from the start or run out by the play', () => {
        expect(favorShortOf([])).toEqual([])
        expect(favorShortOf([{ suit: Suit.Beast, gained: 0 }])).toEqual([
            { suit: Suit.Beast, ranOut: false }
        ])
        expect(
            favorShortOf([
                { suit: Suit.Hearth, gained: 1 },
                { suit: Suit.Hearth, gained: 0 }
            ])
        ).toEqual([{ suit: Suit.Hearth, ranOut: true }])
        expect(
            favorShortOf([
                { suit: Suit.Hearth, gained: 0 },
                { suit: Suit.Hearth, gained: 0 }
            ])
        ).toEqual([{ suit: Suit.Hearth, ranOut: false }])
    })

    it('the Search: an empty bank, a Homeland the bank ran out for, a full gain', () => {
        expect(resolveSearch(board({ [Suit.Hearth]: 3 }), WOLVES).metadata?.favorShort).toEqual([
            { suit: Suit.Beast, ranOut: false }
        ])
        expect(
            resolveSearch(board({ [Suit.Hearth]: 1 }, {}, atValley), INN).metadata?.favorShort
        ).toEqual([{ suit: Suit.Hearth, ranOut: true }])
        expect(resolveSearch(board({}, {}, atValley), INN).metadata?.favorShort).toEqual([
            { suit: Suit.Hearth, ranOut: false }
        ])
        expect(
            resolveSearch(board({ [Suit.Hearth]: 3 }, {}, atValley), INN).metadata?.favorShort
        ).toBeUndefined()
        expect(
            resolveSearch(board({}), WOLVES, { play: SearchPlay.Adviser, faceUp: true }).metadata
                ?.favorShort
        ).toBeUndefined()
    })

    it("Land Warden: the second card's empty bank is recorded beside the kept card's full gain", () => {
        const s = board(
            { [Suit.Hearth]: 3 },
            { dana: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] } },
            carrying(LAND_WARDEN)
        )
        const action = resolveSearch(
            s,
            INN,
            { secondPlay: { cardId: WOLVES, play: SearchPlay.Site } },
            [INN, WOLVES, FILLER]
        )
        expect(action.metadata?.favorGained).toBe(1)
        expect(action.metadata?.favorShort).toEqual([{ suit: Suit.Beast, ranOut: false }])
    })

    describe("Land Warden: the second card's favor as the banks stood when it was played, after the kept card's power", () => {
        // Fabled Feast, kept as an adviser, takes 2 favor (itself and Land Warden) from the Beast bank it names.
        const feastThenWolves = (beast: number) => {
            const s = board(
                { [Suit.Hearth]: 3, [Suit.Beast]: beast },
                { dana: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] } },
                carrying(LAND_WARDEN)
            )
            const keptPlan = playMapChanges(s, 'dana', FEAST, SearchPlay.Adviser, {
                faceUp: true,
                carried: searchPlayModifiers(s)
            })
            const secondPlan = playMapChanges(s, 'dana', WOLVES, SearchPlay.Site, {
                carried: searchPlayModifiers(s),
                earlierMapChanges: keptPlan
            })
            const action = resolveSearch(
                s,
                FEAST,
                {
                    play: SearchPlay.Adviser,
                    faceUp: true,
                    choices: [bank(Suit.Beast)],
                    secondPlay: { cardId: WOLVES, play: SearchPlay.Site }
                },
                [FEAST, WOLVES, FILLER]
            )
            return { s, secondPlan, action }
        }

        it('the Feast empties the Beast bank: Wolves gains no favor and the record says the Beast bank was empty', () => {
            const { s, secondPlan, action } = feastThenWolves(2)
            expect(s.favorBank[Suit.Beast]).toBe(0)
            expect(action.metadata?.favorGained).toBe(0)
            expect(action.metadata?.favorShort).toEqual([{ suit: Suit.Beast, ranOut: false }])
            // The plan, made before anything resolves, still counts the Beast bank as it stood.
            expect(sitePlayGain(secondPlan)).toEqual({ favor: 1, secrets: 0 })
        })

        it('the Beast bank still holds favor after the Feast: Wolves gains 1 and nothing is short', () => {
            const { s, action } = feastThenWolves(3)
            expect(s.favorBank[Suit.Beast]).toBe(0)
            expect(action.metadata?.favorGained).toBe(1)
            expect(action.metadata?.favorShort).toBeUndefined()
        })

        it("the kept card's own empty bank is recorded as before", () => {
            // Fabled Feast to Dana's site with the Hearth bank empty, its power on the Order bank.
            const s = board(
                { [Suit.Order]: 3, [Suit.Beast]: 1 },
                { dana: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] } },
                carrying(LAND_WARDEN)
            )
            const action = resolveSearch(
                s,
                FEAST,
                {
                    choices: [bank(Suit.Order)],
                    secondPlay: { cardId: WOLVES, play: SearchPlay.Site }
                },
                [FEAST, WOLVES, FILLER]
            )
            expect(action.metadata?.favorGained).toBe(1)
            expect(action.metadata?.favorShort).toEqual([{ suit: Suit.Hearth, ranOut: false }])
        })
    })

    it('a facedown adviser played faceup to the site with its bank empty', () => {
        const s = board({}, { dana: { advisers: [{ cardId: WOLVES, faceUp: false }] } })
        const action = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, {
                playerId: 'dana',
                cardId: WOLVES,
                play: SearchPlay.Site
            })
        )
        action.apply(s)
        expect(action.metadata?.favorGained).toBe(0)
        expect(action.metadata?.favorShort).toEqual([{ suit: Suit.Beast, ranOut: false }])
    })
})

describe("on Dana's own view, where Ann's facedown adviser cannot be read", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)
    const hidden = { ann: { advisers: [{ cardId: 'denizen.hearth.storyteller', faceUp: false }] } }

    it('the Search at Fertile Valley with Welcoming Party, and a facedown adviser played faceup: the same gains', () => {
        const s = board(
            { [Suit.Hearth]: 3 },
            { ...hidden, dana: { advisers: [{ cardId: INN, faceUp: false }] } },
            { ...atValley, ...carrying(WELCOMING) }
        )
        const server = JSON.stringify(s.dehydrate())
        const view = ownView(s)
        expect(planned(view, INN)).toEqual(planned(s, INN))
        expect(planned(view, INN)).toEqual({ favor: 3, secrets: 0 })
        const choice = { cardId: INN, play: SearchPlay.Site }
        expect(
            sitePlayGain(HydratedPlayFacedownAdviser.playMapChanges(view, 'dana', choice))
        ).toEqual({ favor: 2, secrets: 0 })
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })
})
