import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PowerTiming, powerIndexOf, powersWithTiming } from '../data/cardPowers.js'
import { OathVisibility } from '../definition/runtime.js'
import {
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithRelics
} from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { bank, yes } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { playMapChanges, reasonCannotPlayCard, type CardPlayOptions } from './cardPlay.js'
import { searchPlayModifiers } from './modifiers.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from './powerChoice.js'
import { OathRevision } from './revision.js'
import '../powers/index.js'

// R-7.3.3: "Gain favor from playing to site, resolve Homeland site powers, and resolve modifiers before resolving
// this." A When Played power's check and its offer read the state the power resolves on.

const BEWITCH = 'denizen.arcane.bewitch'
const SALAD = 'denizen.hearth.salad-days'
const DISSENT = 'denizen.discord.dissent'
const VOW = 'denizen.nomad.vow-of-kinship'
const BOOK = 'relic.book-of-records'
const WOLVES = 'denizen.beast.wolves'
const ARCANE_CARD = 'denizen.arcane.alchemist'
const STONES = 'site.standing-stones'
const VALLEY = 'site.fertile-valley'
const STEPPE = 'site.steppe'
const SLUMS = 'site.great-slums'

const NOW = OathRevision.EngineFixes12
const BEFORE = OathRevision.EngineFixes11

type Seats = { dana?: Partial<OathPlayerState>; ann?: Partial<OathPlayerState> }

/** Dana, an Exile with 2 secrets, at c1, which they rule; Ann, the Chancellor, with 2 secrets, at h1. */
function board(revision: OathRevision, seats: Seats = {}, table: Record<string, unknown> = {}) {
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
            oathRevision: revision,
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
    openTurn(s, 'dana')
    return s
}

const at = (siteCard: string) => ({
    siteCards: { c1: siteCard, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
})
const peoplesFavor = { banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }) }
const carryingBook = {
    pendingSearchModifiers: [{ cardId: BOOK, powerIndex: powerIndexOf(BOOK, PowerTiming.Modifier) }]
}

function banks(s: HydratedOathGameState, held: Partial<Record<Suit, number>>) {
    for (const suit of Object.values(Suit)) s.favorBank[suit] = held[suit] ?? 0
}

/** As the Search's resolve judges a site play: with the Search's carried modifiers. */
function sitePlay(
    s: HydratedOathGameState,
    cardId: string,
    choices: PowerChoice[],
    options: CardPlayOptions = {}
) {
    return reasonCannotPlayCard(s, 'dana', cardId, SearchPlay.Site, {
        carried: searchPlayModifiers(s),
        ...options,
        choices
    })
}

/** Whether the menu offers Bewitch's yes, given the play's own map changes and gains. */
function yesOffered(s: HydratedOathGameState, play: SearchPlay, options: CardPlayOptions = {}) {
    const [power] = powersWithTiming(BEWITCH, PowerTiming.WhenPlayed)
    const changes = playMapChanges(s, 'dana', BEWITCH, play, {
        carried: searchPlayModifiers(s),
        faceUp: true,
        ...options
    })
    return offeredChoices(s, 'dana', power, changes).some((legal) =>
        legal.options.some((option) => option.kind === PowerChoiceKind.Yes)
    )
}

function resolveSearch(
    s: HydratedOathGameState,
    cardId: string,
    play: SearchPlay,
    extra: Partial<SearchResolve> = {}
) {
    s.getPlayerState('dana').handIds = [cardId, FILLER]
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId: 'dana',
            keptCardId: cardId,
            discardOrder: [FILLER],
            play,
            ...extra
        })
    )
    action.apply(s)
    return action
}

const twoAgainstTwo = /you have 2 secrets, not more than the Chancellor's 2/

describe('Bewitch counts the secrets the play gains first (R-7.3.3)', () => {
    it("Standing Stones (the Arcane Homeland gives a secret): 3 against the Chancellor's 2, offered and accepted", () => {
        const s = board(NOW, {}, at(STONES))
        expect(sitePlay(s, BEWITCH, [yes])).toBeUndefined()
        expect(yesOffered(s, SearchPlay.Site)).toBe(true)
        resolveSearch(s, BEWITCH, SearchPlay.Site, { choices: [yes] })
        expect(s.getPlayerState('dana').status).toBe(PlayerStatus.Citizen)
    })

    it('Book of Records carried: the site play gains a secret instead of favor, so 3 against 2', () => {
        const s = board(NOW, { dana: { relicIds: [BOOK] } }, carryingBook)
        expect(sitePlay(s, BEWITCH, [yes])).toBeUndefined()
        expect(yesOffered(s, SearchPlay.Site)).toBe(true)
        resolveSearch(s, BEWITCH, SearchPlay.Site, { choices: [yes] })
        expect(s.getPlayerState('dana').status).toBe(PlayerStatus.Citizen)
    })

    it('the Steppe (the Nomad Homeland) gives an Arcane card nothing: still 2 against 2, neither offered nor accepted', () => {
        const s = board(NOW, {}, at(STEPPE))
        expect(sitePlay(s, BEWITCH, [yes])).toMatch(twoAgainstTwo)
        expect(yesOffered(s, SearchPlay.Site)).toBe(false)
    })

    it.each([
        ["the People's Favor", peoplesFavor],
        ['the Great Slum', at(SLUMS)]
    ])(
        "a card discarded first (%s) gives its secret to the player: 3 against the Chancellor's 2",
        (_, table) => {
            // Tents at Dana's site, ruled by the Chancellor through the Empire's warbands, holds a secret.
            const s = board(
                NOW,
                {},
                { ...table, warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } } }
            )
            s.denizensBySite['c1'] = [TENTS]
            s.addTokensOn(TENTS, { secrets: 1 })
            expect(sitePlay(s, BEWITCH, [yes], { discardFirstCardId: TENTS })).toBeUndefined()
            expect(yesOffered(s, SearchPlay.Site, { discardFirstCardId: TENTS })).toBe(true)
            resolveSearch(s, BEWITCH, SearchPlay.Site, {
                choices: [yes],
                discardFirstCardId: TENTS
            })
            expect(s.getPlayerState('dana').status).toBe(PlayerStatus.Citizen)
            expect(s.getPlayerState('dana').secretsFacedown).toBe(1)
        }
    )

    it('a facedown adviser played faceup to Standing Stones (R-6.1): offered and accepted', () => {
        const s = board(
            NOW,
            { dana: { advisers: [{ cardId: BEWITCH, faceUp: false }] } },
            at(STONES)
        )
        const choice = { cardId: BEWITCH, play: SearchPlay.Site }
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', { ...choice, choices: [yes] })
        ).toBeUndefined()
        const [power] = powersWithTiming(BEWITCH, PowerTiming.WhenPlayed)
        const changes = HydratedPlayFacedownAdviser.playMapChanges(s, 'dana', choice)
        expect(offeredChoices(s, 'dana', power, changes)[0].options).toEqual([yes])
    })

    it('a facedown adviser played faceup with Book of Records held (R-6.1: its mandatory modifier acts): offered and accepted', () => {
        const s = board(NOW, {
            dana: { relicIds: [BOOK], advisers: [{ cardId: BEWITCH, faceUp: false }] }
        })
        const choice = { cardId: BEWITCH, play: SearchPlay.Site }
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', { ...choice, choices: [yes] })
        ).toBeUndefined()
        const [power] = powersWithTiming(BEWITCH, PowerTiming.WhenPlayed)
        expect(
            offeredChoices(
                s,
                'dana',
                power,
                HydratedPlayFacedownAdviser.playMapChanges(s, 'dana', choice)
            )[0].options
        ).toEqual([yes])
    })

    it('R-X.4 — before revision 16, each is judged on the state before the play: refused, and not offered', () => {
        const stones = board(BEFORE, {}, at(STONES))
        expect(sitePlay(stones, BEWITCH, [yes])).toMatch(twoAgainstTwo)
        expect(yesOffered(stones, SearchPlay.Site)).toBe(false)
        const book = board(BEFORE, { dana: { relicIds: [BOOK] } }, carryingBook)
        expect(sitePlay(book, BEWITCH, [yes])).toMatch(twoAgainstTwo)
        const first = board(
            BEFORE,
            {},
            { ...peoplesFavor, warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } } }
        )
        first.denizensBySite['c1'] = [TENTS]
        first.addTokensOn(TENTS, { secrets: 1 })
        expect(sitePlay(first, BEWITCH, [yes], { discardFirstCardId: TENTS })).toMatch(
            /you have 2 secrets, not more than the Chancellor's 3/
        )
        const flip = board(
            BEFORE,
            { dana: { advisers: [{ cardId: BEWITCH, faceUp: false }] } },
            at(STONES)
        )
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(flip, 'dana', {
                cardId: BEWITCH,
                play: SearchPlay.Site,
                choices: [yes]
            })
        ).toMatch(twoAgainstTwo)
    })
})

const salad = (...suits: Suit[]) => suits.map(bank)
const yieldsTwoOfThree = /the banks named yield 2, and 3 can be had/

describe('Salad Days reads the banks the play leaves (R-7.3.3, R-7.1.3)', () => {
    it('Hearth 1, Arcane 3, Order 3: the site takes the Hearth favor, so Arcane, Order, Beast is accepted', () => {
        const s = board(NOW)
        banks(s, { [Suit.Hearth]: 1, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toBeUndefined()
        resolveSearch(s, SALAD, SearchPlay.Site, {
            choices: salad(Suit.Arcane, Suit.Order, Suit.Beast)
        })
        expect(s.favorBank).toMatchObject({ [Suit.Hearth]: 0, [Suit.Arcane]: 2, [Suit.Order]: 2 })
    })

    it('Hearth 1, Arcane, Order and Beast 3: Hearth, Arcane, Order is refused, since Hearth is empty once played', () => {
        const s = board(NOW)
        banks(s, { [Suit.Hearth]: 1, [Suit.Arcane]: 3, [Suit.Order]: 3, [Suit.Beast]: 3 })
        expect(sitePlay(s, SALAD, salad(Suit.Hearth, Suit.Arcane, Suit.Order))).toMatch(
            yieldsTwoOfThree
        )
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toBeUndefined()
    })

    it('Fertile Valley (the Hearth Homeland gives favor): two Hearth favor leave, so Arcane, Order, Beast is accepted', () => {
        const s = board(NOW, {}, at(VALLEY))
        banks(s, { [Suit.Hearth]: 2, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toBeUndefined()
        s.favorBank[Suit.Beast] = 3
        expect(sitePlay(s, SALAD, salad(Suit.Hearth, Suit.Arcane, Suit.Order))).toMatch(
            yieldsTwoOfThree
        )
    })

    it('Fertile Valley with a Hearth card discarded here this turn: the Homeland pays nothing, so one Hearth favor is left', () => {
        const s = board(NOW, { dana: { homelandUsedThisTurn: ['c1:hearth'] } }, at(VALLEY))
        banks(s, { [Suit.Hearth]: 2, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toMatch(
            yieldsTwoOfThree
        )
        expect(sitePlay(s, SALAD, salad(Suit.Hearth, Suit.Arcane, Suit.Order))).toBeUndefined()
    })

    it("Fertile Valley with a Hearth card the People's Favor discards first there: the discard bars the Homeland (R-11.2)", () => {
        const s = board(NOW, {}, { ...at(VALLEY), ...peoplesFavor })
        s.denizensBySite['c1'] = [INN]
        banks(s, { [Suit.Hearth]: 2, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(
            sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast), {
                discardFirstCardId: INN
            })
        ).toMatch(yieldsTwoOfThree)
        expect(
            sitePlay(s, SALAD, salad(Suit.Hearth, Suit.Arcane, Suit.Order), {
                discardFirstCardId: INN
            })
        ).toBeUndefined()
    })

    it('Book of Records carried: the site gives a secret, not the Hearth favor, so three banks still hold favor', () => {
        const s = board(NOW, { dana: { relicIds: [BOOK] } }, carryingBook)
        banks(s, { [Suit.Hearth]: 1, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toMatch(
            yieldsTwoOfThree
        )
    })

    it('Vow of Kinship: the Hearth favor the site gives stays in the Nomad bank, so three banks hold favor', () => {
        const s = board(NOW, { dana: { advisers: [{ cardId: VOW, faceUp: true }] } })
        banks(s, { [Suit.Hearth]: 1, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toMatch(
            yieldsTwoOfThree
        )
        expect(sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Nomad))).toBeUndefined()
    })

    it("Dissent discarded first by the People's Favor gives its 2 favor back to the Discord bank", () => {
        const s = board(NOW, {}, peoplesFavor)
        s.denizensBySite['c1'] = [DISSENT]
        s.addTokensOn(DISSENT, { favor: 2 })
        banks(s, { [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(
            sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Nomad), {
                discardFirstCardId: DISSENT
            })
        ).toMatch(yieldsTwoOfThree)
        expect(
            sitePlay(s, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Discord), {
                discardFirstCardId: DISSENT
            })
        ).toBeUndefined()
    })

    it('an adviser play discarding an adviser that holds favor (R-5.1.4.II): its favor is back in its bank first', () => {
        const held = [DISSENT, 'denizen.order.longbows', 'denizen.beast.wolves'].map((cardId) => ({
            cardId,
            faceUp: true
        }))
        const s = board(NOW, { dana: { advisers: held } })
        s.addTokensOn(DISSENT, { favor: 2 })
        banks(s, { [Suit.Arcane]: 3, [Suit.Order]: 3 })
        const asAdviser = (suits: Suit[]) =>
            reasonCannotPlayCard(s, 'dana', SALAD, SearchPlay.Adviser, {
                faceUp: true,
                discardedAdviserCardIds: [DISSENT],
                choices: salad(...suits)
            })
        expect(asAdviser([Suit.Arcane, Suit.Order, Suit.Nomad])).toMatch(yieldsTwoOfThree)
        expect(asAdviser([Suit.Arcane, Suit.Order, Suit.Discord])).toBeUndefined()
    })

    it('R-X.4 — before revision 16, the banks before the play: each pick judged the other way', () => {
        const site = board(BEFORE)
        banks(site, { [Suit.Hearth]: 1, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(site, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toMatch(
            yieldsTwoOfThree
        )
        const four = board(BEFORE)
        banks(four, { [Suit.Hearth]: 1, [Suit.Arcane]: 3, [Suit.Order]: 3, [Suit.Beast]: 3 })
        expect(sitePlay(four, SALAD, salad(Suit.Hearth, Suit.Arcane, Suit.Order))).toBeUndefined()
        const valley = board(BEFORE, {}, at(VALLEY))
        banks(valley, { [Suit.Hearth]: 2, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(sitePlay(valley, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast))).toMatch(
            yieldsTwoOfThree
        )
        const dissent = board(BEFORE, {}, peoplesFavor)
        dissent.denizensBySite['c1'] = [DISSENT]
        dissent.addTokensOn(DISSENT, { favor: 2 })
        banks(dissent, { [Suit.Arcane]: 3, [Suit.Order]: 3 })
        expect(
            sitePlay(dissent, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Nomad), {
                discardFirstCardId: DISSENT
            })
        ).toBeUndefined()
    })
})

describe('the planned gains are what the play gains', () => {
    // A card with no When Played power that touches the banks or secrets, so what the play leaves is its own gains.
    const cases: Array<[string, () => HydratedOathGameState, string, Partial<SearchResolve>]> = [
        ['the site favor', () => board(NOW), INN, {}],
        ['Standing Stones', () => board(NOW, {}, at(STONES)), ARCANE_CARD, {}],
        ['Fertile Valley', () => board(NOW, {}, at(VALLEY)), INN, {}],
        [
            'Fertile Valley, barred by the ledger',
            () => board(NOW, { dana: { homelandUsedThisTurn: ['c1:hearth'] } }, at(VALLEY)),
            INN,
            {}
        ],
        [
            'Book of Records',
            () => board(NOW, { dana: { relicIds: [BOOK] } }, carryingBook),
            INN,
            {}
        ],
        [
            'Vow of Kinship',
            () => board(NOW, { dana: { advisers: [{ cardId: VOW, faceUp: true }] } }),
            INN,
            {}
        ],
        [
            'a card with favor and a secret discarded first',
            () => {
                const s = board(NOW, {}, peoplesFavor)
                s.denizensBySite['c2'] = [DISSENT]
                s.addTokensOn(DISSENT, { favor: 2, secrets: 1 })
                return s
            },
            INN,
            { discardFirstCardId: DISSENT }
        ],
        [
            'an empty bank',
            () => {
                const s = board(NOW)
                s.favorBank[Suit.Hearth] = 0
                return s
            },
            INN,
            {}
        ]
    ]

    it.each(cases)('%s', (_, setup, cardId, extra) => {
        const s = setup()
        const planned = playMapChanges(s, 'dana', cardId, SearchPlay.Site, {
            carried: searchPlayModifiers(s),
            discardFirstCardId: extra.discardFirstCardId
        })
        const before = s.getPlayerState('dana')
        const secretsBefore = before.secrets + before.secretsFacedown
        const returned = (planned.gains?.returning ?? []).reduce(
            (n, id) => n + s.tokensOn(id).secrets,
            0
        )
        resolveSearch(s, cardId, SearchPlay.Site, extra)
        const after = s.getPlayerState('dana')
        expect(planned.siteId).toBe('c1')
        expect({ ...s.favorBank }).toEqual(planned.gains?.favorBank)
        expect(after.secrets + after.secretsFacedown - secretsBefore).toBe(
            (planned.gains?.secrets ?? 0) + returned
        )
    })

    it("Land Warden's second card starts from what the kept card gained (its secret, its favor, its card discarded first)", () => {
        const s = board(NOW, {}, { ...at(STONES), ...peoplesFavor })
        s.denizensBySite['c2'] = [DISSENT]
        s.addTokensOn(DISSENT, { favor: 2 })
        const kept = playMapChanges(s, 'dana', ARCANE_CARD, SearchPlay.Site, {
            discardFirstCardId: DISSENT
        })
        const second = playMapChanges(s, 'dana', BEWITCH, SearchPlay.Site, {
            earlierMapChanges: kept
        })
        expect(kept.gains).toEqual({
            secrets: 1,
            returning: [DISSENT],
            favorBank: { ...s.favorBank, [Suit.Arcane]: 2, [Suit.Discord]: 5 },
            favorTaken: [{ suit: Suit.Arcane, gained: 1 }],
            favorAfter: 0
        })
        expect(second).toEqual({
            leaving: [DISSENT],
            arriving: [ARCANE_CARD, BEWITCH],
            siteId: 'c1',
            gains: {
                secrets: 2,
                returning: [DISSENT],
                favorBank: { ...s.favorBank, [Suit.Arcane]: 1, [Suit.Discord]: 5 },
                favorTaken: [{ suit: Suit.Arcane, gained: 1 }],
                favorAfter: 0
            }
        })
        // The second play takes no choices, but its offer would see four secrets against the Chancellor's two.
        const [power] = powersWithTiming(BEWITCH, PowerTiming.WhenPlayed)
        expect(offeredChoices(s, 'dana', power, second)[0].options).toEqual([yes])
    })
})

describe("on Dana's own view, where Ann's facedown adviser and the vault cannot be read", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    /** The same answer on the server and on Dana's view, and neither changes the state or what they are served. */
    function sameOnOwnView<T>(
        s: HydratedOathGameState,
        check: (state: HydratedOathGameState) => T,
        expected: T
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, dana))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, dana))).toBe(seen)
    }
    const hidden = { ann: { advisers: [{ cardId: 'denizen.hearth.storyteller', faceUp: false }] } }

    it('Bewitch at Standing Stones: the planned gains, the check and the offer', () => {
        const s = board(NOW, hidden, at(STONES))
        sameOnOwnView(
            s,
            (v) => playMapChanges(v, 'dana', BEWITCH, SearchPlay.Site).gains?.secrets,
            1
        )
        sameOnOwnView(s, (v) => sitePlay(v, BEWITCH, [yes]), undefined)
        sameOnOwnView(s, (v) => yesOffered(v, SearchPlay.Site), true)
    })

    it('Bewitch with a secret on a card discarded first, and Book of Records on a facedown adviser played faceup', () => {
        const s = board(
            NOW,
            {
                ...hidden,
                dana: { relicIds: [BOOK], advisers: [{ cardId: BEWITCH, faceUp: false }] }
            },
            { ...peoplesFavor, warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } } }
        )
        s.denizensBySite['c1'] = [TENTS]
        s.addTokensOn(TENTS, { secrets: 1 })
        const choice = { cardId: BEWITCH, play: SearchPlay.Site, discardFirstCardId: TENTS }
        sameOnOwnView(
            s,
            (v) =>
                HydratedPlayFacedownAdviser.reasonCannotPlay(v, 'dana', {
                    ...choice,
                    choices: [yes]
                }),
            undefined
        )
        sameOnOwnView(
            s,
            (v) => HydratedPlayFacedownAdviser.playMapChanges(v, 'dana', choice).gains?.secrets,
            1
        )
    })

    it('a relic Homeland (Deep Woods): the plan gains nothing from it and reads no relic', () => {
        const s = board(NOW, hidden, {
            ...at('site.deep-woods'),
            relicsBySite: { c1: [{ slotId: 'c1-r1' }] },
            vault: testVaultWithRelics({ 'c1-r1': BOOK })
        })
        sameOnOwnView(s, (v) => playMapChanges(v, 'dana', WOLVES, SearchPlay.Site).gains, {
            secrets: 0,
            returning: [],
            favorBank: { ...s.favorBank, [Suit.Beast]: 2 },
            favorTaken: [{ suit: Suit.Beast, gained: 1 }],
            favorAfter: 0
        })
    })

    it('Salad Days at Fertile Valley, and with Dissent discarded first', () => {
        const valley = board(NOW, hidden, at(VALLEY))
        banks(valley, { [Suit.Hearth]: 2, [Suit.Arcane]: 3, [Suit.Order]: 3 })
        sameOnOwnView(
            valley,
            (v) => sitePlay(v, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Beast)),
            undefined
        )
        const dissent = board(NOW, hidden, peoplesFavor)
        dissent.denizensBySite['c1'] = [DISSENT]
        dissent.addTokensOn(DISSENT, { favor: 2 })
        banks(dissent, { [Suit.Arcane]: 3, [Suit.Order]: 3 })
        const refusal = sitePlay(dissent, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Nomad), {
            discardFirstCardId: DISSENT
        })
        expect(refusal).toMatch(yieldsTwoOfThree)
        sameOnOwnView(
            dissent,
            (v) =>
                sitePlay(v, SALAD, salad(Suit.Arcane, Suit.Order, Suit.Nomad), {
                    discardFirstCardId: DISSENT
                }),
            refusal
        )
    })
})
