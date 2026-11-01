import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from '../actions/searchResolve.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, card } from '../testing/choices.js'
import { FILLER, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { playMapChanges, type CardPlayOptions } from '../util/cardPlay.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import './index.js'

// The Great Slum (R-11.10): "When playing or moving a card to this site, you may discard a card here first." A swap
// moves the two pieces to each other's location (R-10.25), so a swap that puts a card at the Great Slum is a move
// there: the Horned Mask and Great Herd may discard a card there first. Never the card swapped, Great Herd itself,
// or a locked card (R-7.2.2). From revision 32; before it, a game keeps the swap it was recorded with.

const MASK = 'relic.horned-mask'
const HERD = 'denizen.nomad.great-herd'
const ORACLE = 'denizen.nomad.oracle'
const HOMESTEADERS = 'denizen.hearth.homesteaders'
const LONGBOWS = 'denizen.order.longbows'
const WOLVES = 'denizen.beast.wolves'
const SONGS = 'denizen.hearth.tavern-songs'
const MARRIAGE = 'denizen.hearth.marriage'
const SALT = 'denizen.discord.salt-the-earth'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'
const SCOUTS = 'denizen.order.scouts'
const WELCOMING = 'denizen.hearth.welcoming-party'

const DANA = 'dana'
const RHYS = 'rhys'
const FIXED = OathRevision.EngineFixes27
const BEFORE = OathRevision.EngineFixes26
const SLUM = 'site.great-slums'
const MASK_POWER = powerIndexOf(MASK, PowerTiming.Action)
const FIRST = 'a denizen at the Great Slum to discard first'
const NOT_OFFERED = /is not among the options for a denizen at the Great Slum to discard first/

const cardIds = (options: readonly PowerChoice[]) =>
    options.flatMap((option) => (option.kind === PowerChoiceKind.Card ? [option.cardId] : []))

describe('the Horned Mask swapping an adviser into the Great Slum', () => {
    interface Table {
        revision?: OathRevision
        /** The denizens at c1, Dana's site. */
        atC1?: string[]
        /** c1's site card: the Great Slum unless named. */
        c1?: string
        /** Rhys holds Ancient Bloodline and rules c1 with two warbands. */
        bloodline?: boolean
        /** Dana is a Citizen and Rhys the Chancellor. */
        citizen?: boolean
        /** c1 has Salt the Earth's capacity of 1. */
        salted?: boolean
    }

    /**
     * Dana (Exile) at c1, a full Great Slum holding the Wolves, the Tents and Tavern Songs, with the Horned Mask on
     * their board, two secrets, and Homesteaders and Longbows faceup as advisers. Rhys is at c2.
     */
    function table({
        revision = FIXED,
        atC1 = [WOLVES, TENTS, SONGS],
        c1 = SLUM,
        bloodline = false,
        citizen = false,
        salted = false
    }: Table = {}): HydratedOathGameState {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: DANA,
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 3,
                    secrets: 2,
                    relicIds: [MASK],
                    status: citizen ? PlayerStatus.Citizen : PlayerStatus.Exile,
                    advisers: [
                        { cardId: HOMESTEADERS, faceUp: true },
                        { cardId: LONGBOWS, faceUp: true }
                    ]
                }),
                testPlayer({
                    playerId: RHYS,
                    color: Color.Blue,
                    siteId: 'c2',
                    favor: 3,
                    secrets: 2,
                    status: citizen ? PlayerStatus.Chancellor : PlayerStatus.Exile,
                    advisers: bloodline ? [{ cardId: BLOODLINE, faceUp: true }] : []
                })
            ]),
            {
                oathRevision: revision,
                denizensBySite: { c1: atC1, c2: [], p1: [], h1: [] },
                warbandsBySite: bloodline ? { c1: { [RHYS]: 2 } } : {},
                siteCapacityOverrides: salted ? { c1: 1 } : {},
                siteCards: { c1, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
            }
        )
        openTurn(s, DANA)
        return s
    }

    function maskPower() {
        const power = cardPower(MASK, MASK_POWER)
        if (!power) throw Error(`${MASK} prints no Action power`)
        return power
    }

    /** The choices the Mask offers, read on `earlier`, the picks made so far. */
    const offered = (s: HydratedOathGameState, earlier: PowerChoice[] = []) =>
        offeredChoices(s, DANA, maskPower(), undefined, earlier)

    /** The cards offered to discard first once the adviser and the site's card are picked. */
    const firstsFor = (s: HydratedOathGameState, adviser: string, atSite: string) =>
        cardIds(offered(s, [card(adviser), card(atSite)])[2]?.options ?? [])

    const reasonFor = (s: HydratedOathGameState, choices: PowerChoice[]) =>
        HydratedUseActionPower.reasonCannotUse(s, DANA, MASK, MASK_POWER, choices)

    function expectRefusedUnchanged(s: HydratedOathGameState, choices: PowerChoice[]) {
        expect(reasonFor(s, choices)).toBeDefined()
        const before = JSON.stringify(s.dehydrate())
        expect(() => actionPowerUse(DANA, MASK, choices).apply(s)).toThrow()
        expect(JSON.stringify(s.dehydrate())).toBe(before)
    }

    it('from revision 32 it asks a third, optional choice, with the words Homesteaders uses', () => {
        const third = offered(table())[2]
        expect(third.spec.what).toBe(FIRST)
        expect(third.spec.min).toBe(0)
        expect(third.spec.max).toBe(1)
    })

    it('it offers every other card at the full Great Slum, never the card swapped', () => {
        const s = table()
        expect(firstsFor(s, LONGBOWS, TENTS)).toEqual([WOLVES, SONGS])
        expect(firstsFor(s, LONGBOWS, WOLVES)).toEqual([TENTS, SONGS])
    })

    it('the Wolves discarded first: the swap is made, and the Mask is paid with a secret', () => {
        const s = table()
        const choices = [card(LONGBOWS), card(TENTS), card(WOLVES)]
        expect(reasonFor(s, choices)).toBeUndefined()
        const used = actionPowerUse(DANA, MASK, choices)
        used.apply(s)
        expect(s.denizensAt('c1')).toEqual([LONGBOWS, SONGS])
        expect(s.getPlayerState(DANA).advisers.map((a) => a.cardId)).toEqual([HOMESTEADERS, TENTS])
        expect(s.getPlayerState(DANA).secrets).toBe(1)
        expect(s.cardTokens[MASK]?.secrets).toBe(1)
        expect(used.metadata?.summary).toBe(
            `Horned Mask: discarded ${WOLVES} first; swapped ${LONGBOWS} with ${TENTS}`
        )
        expect(used.metadata?.pileDeposits).toEqual([
            expect.objectContaining({ region: Region.Provinces, cardIds: [WOLVES] })
        ])
    })

    it('with nothing discarded first the swap is as before', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({ revision })
            const used = actionPowerUse(DANA, MASK, [card(LONGBOWS), card(TENTS)])
            used.apply(s)
            expect(s.denizensAt('c1')).toEqual([WOLVES, LONGBOWS, SONGS])
            expect(used.metadata?.summary).toBe(`Horned Mask: swapped ${LONGBOWS} with ${TENTS}`)
            expect(used.metadata?.pileDeposits).toBeUndefined()
        }
    })

    it('the card swapped, named to discard first too, is refused and nothing changes', () => {
        const s = table()
        const choices = [card(LONGBOWS), card(TENTS), card(TENTS)]
        expect(reasonFor(s, choices)).toMatch(NOT_OFFERED)
        expectRefusedUnchanged(s, choices)
    })

    it('a locked card (Marriage, printed locked) is not offered, and naming it is refused', () => {
        const s = table({ atC1: [MARRIAGE, WOLVES, TENTS] })
        expect(firstsFor(s, LONGBOWS, TENTS)).toEqual([WOLVES])
        expectRefusedUnchanged(s, [card(LONGBOWS), card(TENTS), card(MARRIAGE)])
    })

    it('away from the Great Slum nothing is offered, and naming a card is refused', () => {
        const s = table({ c1: 'site.plains' })
        expect(firstsFor(s, LONGBOWS, TENTS)).toEqual([])
        expectRefusedUnchanged(s, [card(LONGBOWS), card(TENTS), card(WOLVES)])
        expect(reasonFor(s, [card(LONGBOWS), card(TENTS)])).toBeUndefined()
    })

    it('before revision 32 it asks two choices, and a card to discard first is refused', () => {
        const s = table({ revision: BEFORE })
        expect(offered(s, [card(LONGBOWS), card(TENTS)])).toHaveLength(2)
        expect(reasonFor(s, [card(LONGBOWS), card(TENTS), card(WOLVES)])).toBeDefined()
        expectRefusedUnchanged(s, [card(LONGBOWS), card(TENTS), card(WOLVES)])
    })

    it("with an enemy's Ancient Bloodline ruling the Great Slum, no card there is swapped or offered", () => {
        const s = table({ bloodline: true })
        const choices = offered(s, [card(LONGBOWS)])
        expect(cardIds(choices[1].options)).toEqual([])
        expect(firstsFor(s, LONGBOWS, TENTS)).toEqual([])
        expectRefusedUnchanged(s, [card(LONGBOWS), card(TENTS), card(WOLVES)])
    })

    it('control: a Citizen is no enemy of the Chancellor holding Ancient Bloodline, so the cards are offered', () => {
        const s = table({ bloodline: true, citizen: true })
        expect(firstsFor(s, LONGBOWS, TENTS)).toEqual([WOLVES, SONGS])
        actionPowerUse(DANA, MASK, [card(LONGBOWS), card(TENTS), card(WOLVES)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([LONGBOWS, SONGS])
    })

    it("at Salt the Earth's capacity of 1 the Great Slum holds only Salt the Earth, which is locked: nothing is swapped or offered", () => {
        const s = table({ atC1: [SALT], salted: true })
        expect(cardIds(offered(s, [card(LONGBOWS)])[1].options)).toEqual([])
        expect(firstsFor(s, LONGBOWS, SALT)).toEqual([])
    })

    it('a swap with a card discarded first is not undoable (the discard reaches the pile); without one it is', () => {
        const kept = table()
        const plain = actionPowerUse(DANA, MASK, [card(LONGBOWS), card(TENTS)])
        plain.apply(kept)
        expect(plain.revealsInfo).toBe(false)
        const s = table()
        const first = actionPowerUse(DANA, MASK, [card(LONGBOWS), card(TENTS), card(WOLVES)])
        first.apply(s)
        expect(first.revealsInfo).toBe(true)
    })

    it("on Dana's own view: the same offers and answers, the state neither copied nor changed", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
        for (const [s, named, refused] of [
            [table(), WOLVES, false],
            [table(), TENTS, true],
            [table({ atC1: [MARRIAGE, WOLVES, TENTS] }), MARRIAGE, true],
            [table({ bloodline: true }), WOLVES, true],
            [table({ revision: BEFORE }), WOLVES, true]
        ] as const) {
            s.getPlayerState(RHYS).handIds = [SCOUTS]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = OathVisibility.state.guardForExecution(
                new HydratedOathGameState(served(s, dana)),
                dana
            )
            const choices = [card(LONGBOWS), card(TENTS), card(named)]
            expect(firstsFor(view, LONGBOWS, TENTS)).toEqual(firstsFor(s, LONGBOWS, TENTS))
            expect(reasonFor(view, choices)).toBe(reasonFor(s, choices))
            expect(reasonFor(view, choices) !== undefined).toBe(refused)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})

describe('Great Herd swapping into the Great Slum', () => {
    interface Board {
        revision?: OathRevision
        /** Where each site's denizens stand; Dana stands at c1. */
        sites?: Record<string, string[]>
        /** The site cards at c1 and c2. */
        c1?: string
        c2?: string
        /** Rhys holds Ancient Bloodline and rules c1 with two warbands. */
        bloodline?: boolean
    }

    /** Dana (Exile) at c1 with Great Herd drawn beside a filler; the Oracle, a Nomad card, stands at h1. */
    function board({
        revision = FIXED,
        sites = {},
        c1 = SLUM,
        c2 = 'site.river',
        bloodline = false
    }: Board = {}): HydratedOathGameState {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: DANA,
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 4,
                    secrets: 2,
                    supply: 5,
                    handIds: [HERD, FILLER]
                }),
                testPlayer({
                    playerId: RHYS,
                    color: Color.Blue,
                    siteId: 'c2',
                    favor: 4,
                    secrets: 2,
                    supply: 5,
                    advisers: bloodline ? [{ cardId: BLOODLINE, faceUp: true }] : []
                })
            ]),
            {
                oathRevision: revision,
                denizensBySite: { c1: [], c2: [], p1: [], h1: [ORACLE], ...sites },
                warbandsBySite: bloodline ? { c1: { [RHYS]: 2 } } : {},
                siteCards: { c1, c2, p1: 'site.marshes', h1: 'site.mountain' }
            }
        )
        openTurn(s, DANA)
        return s
    }

    function herdPower() {
        const power = cardPower(HERD, powerIndexOf(HERD, PowerTiming.WhenPlayed))
        if (!power) throw Error(`${HERD} prints no When Played power`)
        return power
    }

    /** Great Herd kept and played (to Dana's site unless named), swapping with `target`, `first` discarded first. */
    function herdPlay(
        target?: string,
        first?: string,
        extra: Partial<SearchResolveChoice> = {}
    ): SearchResolveChoice {
        return {
            keptCardId: HERD,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            choices: [...(target ? [card(target)] : []), ...(first ? [card(first)] : [])],
            ...extra
        }
    }

    /** The cards offered to discard first once `target` is picked, as the play's map leaves them. */
    function firstsFor(
        s: HydratedOathGameState,
        target: string | undefined,
        play: SearchPlay = SearchPlay.Site,
        options: CardPlayOptions = {}
    ): string[] {
        const changes = playMapChanges(s, DANA, HERD, play, options)
        const offered = offeredChoices(s, DANA, herdPower(), changes, target ? [card(target)] : [])
        return cardIds(offered[1]?.options ?? [])
    }

    const reasonFor = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
        HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

    function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
        const a = new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: DANA, ...choice })
        )
        a.apply(s)
        return a
    }

    function expectRefusedUnchanged(s: HydratedOathGameState, choice: SearchResolveChoice) {
        expect(reasonFor(s, choice)).toBeDefined()
        const before = JSON.stringify(s.dehydrate())
        expect(() => resolve(s, choice)).toThrow()
        expect(JSON.stringify(s.dehydrate())).toBe(before)
    }

    describe('played to the Great Slum, so the card it swaps with moves there', () => {
        const sites = { c1: [WOLVES, SCOUTS] }

        it('it offers the cards at the Great Slum, never Great Herd itself', () => {
            const s = board({ sites })
            expect(firstsFor(s, ORACLE)).toEqual([WOLVES, SCOUTS])
        })

        it('the Wolves discarded first, the Oracle comes to the Great Slum and Great Herd goes to h1', () => {
            const s = board({ sites })
            expect(reasonFor(s, herdPlay(ORACLE, WOLVES))).toBeUndefined()
            const a = resolve(s, herdPlay(ORACLE, WOLVES))
            expect(s.denizensAt('c1')).toEqual([SCOUTS, ORACLE])
            expect(s.denizensAt('h1')).toEqual([HERD])
            expect(a.metadata?.whenPlayed).toBe(
                `discarded ${WOLVES} first; swapped Great Herd with ${ORACLE}`
            )
            expect(a.metadata?.pileDeposits).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ region: Region.Provinces, cardIds: [WOLVES] })
                ])
            )
        })

        it('Great Herd named to discard first is refused, and nothing changes', () => {
            expectRefusedUnchanged(board({ sites }), herdPlay(ORACLE, HERD))
        })

        it("at a full Great Slum the play's own card discarded first is gone: it is not offered again", () => {
            const s = board({ sites: { c1: [WOLVES, SCOUTS, SONGS] } })
            expect(firstsFor(s, ORACLE, SearchPlay.Site, { discardFirstCardId: SONGS })).toEqual([
                WOLVES,
                SCOUTS
            ])
            expectRefusedUnchanged(s, herdPlay(ORACLE, SONGS, { discardFirstCardId: SONGS }))
            const a = resolve(s, herdPlay(ORACLE, WOLVES, { discardFirstCardId: SONGS }))
            expect(s.denizensAt('c1')).toEqual([SCOUTS, ORACLE])
            expect(s.denizensAt('h1')).toEqual([HERD])
            expect(a.metadata?.discardedCardIds).toEqual(expect.arrayContaining([SONGS]))
        })

        it('a target at the Great Slum itself moves nothing (R-10.25), so nothing is offered', () => {
            const s = board({ sites: { c1: [ORACLE, WOLVES], h1: [] } })
            expect(firstsFor(s, ORACLE)).toEqual([])
            expectRefusedUnchanged(s, herdPlay(ORACLE, WOLVES))
        })

        it('a locked card (Marriage) is not offered, and naming it is refused', () => {
            const s = board({ sites: { c1: [MARRIAGE, WOLVES] } })
            expect(firstsFor(s, ORACLE)).toEqual([WOLVES])
            expectRefusedUnchanged(s, herdPlay(ORACLE, MARRIAGE))
        })

        /** The Search under way uses Welcoming Party, which stands at the Great Slum beside the Wolves (R-7.4.3). */
        function welcomingInUse(): HydratedOathGameState {
            const s = board({ sites: { c1: [WELCOMING, WOLVES] } })
            s.pendingSearchModifiers = [
                { cardId: WELCOMING, powerIndex: powerIndexOf(WELCOMING, PowerTiming.Modifier) }
            ]
            s.searchModifiersInUse = [WELCOMING]
            return s
        }

        it('a modifier the Search uses (Welcoming Party) is not offered, and naming it is refused', () => {
            const s = welcomingInUse()
            expect(firstsFor(s, ORACLE)).toEqual([WOLVES])
            expectRefusedUnchanged(s, herdPlay(ORACLE, WELCOMING))
            const a = resolve(s, herdPlay(ORACLE, WOLVES))
            expect(a.metadata?.whenPlayed).toBe(
                `discarded ${WOLVES} first; swapped Great Herd with ${ORACLE}`
            )
            expect(s.denizensAt('c1')).toEqual([WELCOMING, ORACLE])
            expect(s.denizensAt('h1')).toEqual([HERD])
        })

        it("a modifier the Search uses, on Dana's own view: not offered, and refused alike", () => {
            const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
            const s = welcomingInUse()
            s.getPlayerState(RHYS).handIds = [SCOUTS]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = OathVisibility.state.guardForExecution(
                new HydratedOathGameState(served(s, dana)),
                dana
            )
            const named = herdPlay(ORACLE, WELCOMING)
            expect(firstsFor(view, ORACLE)).toEqual([WOLVES])
            expect(reasonFor(view, named)).toBeDefined()
            expect(reasonFor(view, named)).toBe(reasonFor(s, named))
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        })

        it("with an enemy's Ancient Bloodline ruling it, Great Herd is locked there: no swap, nothing offered", () => {
            const s = board({ sites, bloodline: true })
            const offered = offeredChoices(
                s,
                DANA,
                herdPower(),
                playMapChanges(s, DANA, HERD, SearchPlay.Site),
                [card(ORACLE)]
            )
            expect(offered.map((legal) => cardIds(legal.options))).toEqual([[], []])
            expectRefusedUnchanged(s, herdPlay(ORACLE, WOLVES))
        })
    })

    describe('swapping with a card at the Great Slum, so Great Herd moves there', () => {
        const sites = { c1: [], c2: [ORACLE, WOLVES], h1: [] }

        it('played to Dana’s site: it offers the other cards at the Great Slum, never the card swapped', () => {
            const s = board({ sites, c1: 'site.plains', c2: SLUM })
            expect(firstsFor(s, ORACLE)).toEqual([WOLVES])
            expectRefusedUnchanged(s, herdPlay(ORACLE, ORACLE))
        })

        it('the Wolves discarded first: Great Herd takes the Oracle’s place at the Great Slum', () => {
            const s = board({ sites, c1: 'site.plains', c2: SLUM })
            const a = resolve(s, herdPlay(ORACLE, WOLVES))
            expect(s.denizensAt('c2')).toEqual([HERD])
            expect(s.denizensAt('c1')).toEqual([ORACLE])
            expect(a.metadata?.whenPlayed).toBe(
                `discarded ${WOLVES} first; swapped Great Herd with ${ORACLE}`
            )
        })
    })

    it('when neither card moves to a Great Slum nothing is offered, and naming a card is refused', () => {
        const s = board({ sites: { c1: [WOLVES] }, c1: 'site.plains' })
        expect(firstsFor(s, ORACLE)).toEqual([])
        expectRefusedUnchanged(s, herdPlay(ORACLE, WOLVES))
        expect(reasonFor(s, herdPlay(ORACLE))).toBeUndefined()
    })

    it('with no card swapped nothing is offered, and a card to discard first alone is refused', () => {
        const s = board({ sites: { c1: [WOLVES] } })
        expect(firstsFor(s, undefined)).toEqual([])
        expectRefusedUnchanged(s, herdPlay(undefined, WOLVES))
    })

    it('before revision 32 it asks only the swap, and a card to discard first is refused', () => {
        const s = board({ revision: BEFORE, sites: { c1: [WOLVES, SCOUTS] } })
        const offered = offeredChoices(
            s,
            DANA,
            herdPower(),
            playMapChanges(s, DANA, HERD, SearchPlay.Site),
            [card(ORACLE)]
        )
        expect(offered).toHaveLength(1)
        expectRefusedUnchanged(s, herdPlay(ORACLE, WOLVES))
        resolve(s, herdPlay(ORACLE))
        expect(s.denizensAt('c1')).toEqual([WOLVES, SCOUTS, ORACLE])
    })

    it("on Dana's own view: the same offers and answers, the state neither copied nor changed", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
        for (const [s, choice, refused] of [
            [board({ sites: { c1: [WOLVES, SCOUTS] } }), herdPlay(ORACLE, WOLVES), false],
            [board({ sites: { c1: [WOLVES, SCOUTS] } }), herdPlay(ORACLE, HERD), true],
            [
                board({
                    sites: { c1: [], c2: [ORACLE, WOLVES], h1: [] },
                    c1: 'site.plains',
                    c2: SLUM
                }),
                herdPlay(ORACLE, ORACLE),
                true
            ],
            [board({ revision: BEFORE, sites: { c1: [WOLVES] } }), herdPlay(ORACLE, WOLVES), true]
        ] as const) {
            s.getPlayerState(RHYS).handIds = [SCOUTS]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = OathVisibility.state.guardForExecution(
                new HydratedOathGameState(served(s, dana)),
                dana
            )
            expect(firstsFor(view, ORACLE)).toEqual(firstsFor(s, ORACLE))
            expect(reasonFor(view, choice)).toBe(reasonFor(s, choice))
            expect(reasonFor(view, choice) !== undefined).toBe(refused)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})
