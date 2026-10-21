import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve, type SearchResolveChoice } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { Banner } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { PowerTiming, powerIndexOf, powersWithTiming } from '../data/cardPowers.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, card } from '../testing/choices.js'
import { FILLER, TENTS } from '../testing/cards.js'
import { required } from '../testing/required.js'
import { served } from '../testing/projection.js'
import { playMapChanges } from '../util/cardPlay.js'
import { isLockedFor } from '../util/locked.js'
import { legalChoices, offeredChoices } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const HERD = 'denizen.nomad.great-herd'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'
const ROVING = 'denizen.beast.roving-terror'
const ENCHANTRESS = 'denizen.discord.enchantress'
const HORNED_MASK = 'relic.horned-mask'
const ROAR = 'denizen.beast.threatening-roar'
const SALT = 'denizen.discord.salt-the-earth'
const MARRIAGE = 'denizen.hearth.marriage'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const LAND_WARDEN = 'denizen.hearth.land-warden'

const herdPower = required(powersWithTiming(HERD, PowerTiming.WhenPlayed)[0], 'Great Herd When Played')
const rovingPower = required(powersWithTiming(ROVING, PowerTiming.Action)[0], 'Roving Terror Action')
const enchantressPower = required(powersWithTiming(ENCHANTRESS, PowerTiming.Action)[0], 'Enchantress Action')

/**
 * Rhys rules c1 (two warbands) and, with `bloodline`, holds Ancient Bloodline faceup, so for Dana, an enemy, the
 * denizens at c1 are locked. Dana stands at c1, Rhys at `rhysAt`. c1 and c2 are in the Cradle, h1 (where Tents, a
 * Nomad card, stands) in the Hinterland; nobody rules c2 or h1.
 */
function board(
    opts: {
        bloodline?: boolean
        revision?: OathRevision
        rhysAt?: string
        danaAt?: string
        sites?: Record<string, string[]>
        siteCards?: Record<string, string>
        dana?: Record<string, unknown>
        rhys?: Record<string, unknown>
        state?: Record<string, unknown>
        turn?: string
    } = {}
) {
    const s = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: opts.danaAt ?? 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { dana: 2 }, ...opts.dana }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: opts.rhysAt ?? 'c2',
                favor: 4,
                secrets: 3,
                supply: 6,
                warbandsOnBoard: { rhys: 2 },
                advisers: opts.bloodline === false ? [] : [{ cardId: BLOODLINE, faceUp: true }],
                ...opts.rhys
            })
        ],
        {
            oathRevision: opts.revision ?? OathRevision.EngineFixes12,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [TENTS], ...opts.sites },
            warbandsBySite: { c1: { rhys: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.wastes', ...opts.siteCards },
            ...opts.state
        }
    )
    openTurn(s, opts.turn ?? 'dana')
    return s
}

const favorHeld = (holder: string) => ({ banners: { [Banner.PeoplesFavor]: { value: 1, holderPlayerId: holder }, [Banner.DarkestSecret]: { value: 1 } } })

function herdPlay(playerId: string, extra: Partial<SearchResolveChoice> = {}): SearchResolveChoice & { playerId: string } {
    return { playerId, keptCardId: HERD, discardOrder: [FILLER], play: SearchPlay.Site, choices: [], ...extra }
}

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice & { playerId: string }) {
    s.getPlayerState(choice.playerId).handIds = [choice.keptCardId, FILLER]
    const a = new HydratedSearchResolve(buildAction(SearchResolve, choice))
    a.apply(s)
    return a
}

/** What a menu offers for Great Herd's "may swap", on the play's own map changes (R-7.3.3). */
function herdOffer(s: HydratedOathGameState, playerId: string, toSiteId?: string) {
    const changes = playMapChanges(s, playerId, HERD, SearchPlay.Site, toSiteId ? { toSiteId } : {})
    return offeredChoices(s, playerId, herdPower, changes)[0].options
}

/** Judged on the hand as it is; a kept card not in it is drawn first. */
function refusalOf(s: HydratedOathGameState, choice: SearchResolveChoice & { playerId: string }) {
    const player = s.getPlayerState(choice.playerId)
    if (!player.handIds?.includes(choice.keptCardId)) player.handIds = [choice.keptCardId, FILLER]
    return HydratedSearchResolve.reasonCannotResolve(s, choice.playerId, choice)
}

const herdLockedAt = (siteId: string) => `Great Herd is locked at ${siteId} once played there, so it cannot be swapped`

describe('Great Herd does not swap itself out of a site where it is locked for its player (R-7.2.2; Great Herd and Ancient Bloodline Q&A)', () => {
    it("played to c1, which Rhys rules with Ancient Bloodline, Dana's Great Herd is offered no swap", () => {
        const s = board()
        expect(herdOffer(s, 'dana')).toEqual([])
        // The domain alone still lists Tents: it is the play's destination that is locked, not the target.
        expect(legalChoices(s, 'dana', herdPower)[0].options).toEqual([card(TENTS)])
    })

    it('a swap sent anyway is refused, and the play changes nothing', () => {
        const s = board()
        expect(refusalOf(s, herdPlay('dana', { choices: [card(TENTS)] }))).toBe(herdLockedAt('c1'))
        const before = JSON.stringify(s.dehydrate())
        expect(() => resolve(s, herdPlay('dana', { choices: [card(TENTS)] }))).toThrow(/^Cannot resolve search: Great Herd is locked at c1/)
        expect(JSON.stringify(s.dehydrate())).toBe(before)
    })

    it('kept where it is played, the play goes on as before: Great Herd stays at c1, locked for Dana', () => {
        const s = board()
        expect(refusalOf(s, herdPlay('dana'))).toBeUndefined()
        const a = resolve(s, herdPlay('dana'))
        expect(s.denizensBySite['c1']).toEqual([HERD])
        expect(s.denizensBySite['h1']).toEqual([TENTS])
        expect(isLockedFor(s, 'dana', HERD)).toBe(true)
        expect(a.metadata?.whenPlayed).toBe('kept Great Herd where it was played')
    })

    it("Rhys, Bloodline's ruler, is exempt: Rhys's own Great Herd at c1 is offered the swap and swaps", () => {
        const s = board({ rhysAt: 'c1', turn: 'rhys' })
        expect(herdOffer(s, 'rhys')).toEqual([card(TENTS)])
        resolve(s, herdPlay('rhys', { choices: [card(TENTS)] }))
        expect(s.denizensBySite['c1']).toEqual([TENTS])
        expect(s.denizensBySite['h1']).toEqual([HERD])
    })

    it("the ruler's own swap with a Nomad card at the same site is still the revision 10 no-op", () => {
        const s = board({ rhysAt: 'c1', turn: 'rhys', sites: { c1: [TENTS], h1: [] } })
        expect(herdOffer(s, 'rhys')).toEqual([card(TENTS)])
        resolve(s, herdPlay('rhys', { choices: [card(TENTS)] }))
        expect(s.denizensBySite['c1']).toEqual([TENTS, HERD])
    })

    it('without Ancient Bloodline, Dana swaps as before (control)', () => {
        const s = board({ bloodline: false })
        expect(herdOffer(s, 'dana')).toEqual([card(TENTS)])
        resolve(s, herdPlay('dana', { choices: [card(TENTS)] }))
        expect(s.denizensBySite['c1']).toEqual([TENTS])
        expect(s.denizensBySite['h1']).toEqual([HERD])
    })

    describe("played to another site with the People's Favor (R-5.1.4.I): the destination's lock counts, not the pawn's site", () => {
        it('from c2 to c1, which Rhys rules: no swap is offered, and one sent is refused', () => {
            const s = board({ danaAt: 'c2', state: favorHeld('dana') })
            expect(herdOffer(s, 'dana', 'c1')).toEqual([])
            expect(refusalOf(s, herdPlay('dana', { toSiteId: 'c1', choices: [card(TENTS)] }))).toBe(herdLockedAt('c1'))
            expect(refusalOf(s, herdPlay('dana', { toSiteId: 'c1' }))).toBeUndefined()
        })

        it('from c1 to c2, which nobody rules: the swap is offered and swaps', () => {
            const s = board({ state: favorHeld('dana') })
            expect(herdOffer(s, 'dana', 'c2')).toEqual([card(TENTS)])
            resolve(s, herdPlay('dana', { toSiteId: 'c2', choices: [card(TENTS)] }))
            expect(s.denizensBySite['c2']).toEqual([TENTS])
            expect(s.denizensBySite['h1']).toEqual([HERD])
        })
    })

    it('a facedown Great Herd turned faceup to c1 (R-6.1) is refused the swap the same way', () => {
        const s = board({ dana: { advisers: [{ cardId: HERD, faceUp: false }] } })
        const flip = (choices: ReturnType<typeof card>[]) =>
            new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'dana', cardId: HERD, play: SearchPlay.Site, choices }))
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', flip([card(TENTS)]))).toBe(herdLockedAt('c1'))
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', flip([]))).toBeUndefined()
    })

    it("as Land Warden's second card at c1 it is asked nothing and stays where it was played", () => {
        const s = board({
            dana: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] },
            state: { pendingSearchModifiers: [{ cardId: LAND_WARDEN, powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier) }] }
        })
        s.getPlayerState('dana').handIds = [WOLVES, HERD, FILLER]
        const a = new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'dana', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: { cardId: HERD, play: SearchPlay.Site } })
        )
        a.apply(s)
        expect(s.denizensBySite['c1']).toEqual([WOLVES, HERD])
        expect(a.metadata?.secondWhenPlayed).toBe('kept Great Herd where it was played')
    })

    it('before revision 16 a recorded game replays as it was recorded: the swap is offered and moves Great Herd out of c1', () => {
        const s = board({ revision: OathRevision.EngineFixes11 })
        expect(herdOffer(s, 'dana')).toEqual([card(TENTS)])
        expect(refusalOf(s, herdPlay('dana', { choices: [card(TENTS)] }))).toBeUndefined()
        resolve(s, herdPlay('dana', { choices: [card(TENTS)] }))
        expect(s.denizensBySite['c1']).toEqual([TENTS])
        expect(s.denizensBySite['h1']).toEqual([HERD])
    })
})

describe('Roving Terror does not move itself out of a site where it is locked for its user (R-7.2.2; Ancient Bloodline Q&A)', () => {
    const atC1 = (extra: Parameters<typeof board>[0] = {}) => board({ sites: { c1: [ROVING], h1: [TENTS] }, ...extra })
    const reasonCannotUse = (s: HydratedOathGameState, playerId: string, choices: ReturnType<typeof card>[]) =>
        HydratedUseActionPower.reasonCannotUse(s, playerId, ROVING, powerIndexOf(ROVING, PowerTiming.Action), choices)

    it('used by Dana at c1, which Rhys rules with Ancient Bloodline: nothing to pick, the use is refused and nothing is paid', () => {
        const s = atC1()
        expect(isLockedFor(s, 'dana', ROVING)).toBe(true)
        expect(legalChoices(s, 'dana', rovingPower)[0].options).toEqual([])
        expect(reasonCannotUse(s, 'dana', [card(TENTS)])).toBeDefined()
        const before = JSON.stringify(s.dehydrate())
        expect(() => actionPowerUse('dana', ROVING, [card(TENTS)]).apply(s)).toThrow(/not among the options/)
        expect(JSON.stringify(s.dehydrate())).toBe(before)
    })

    it("used by Rhys, Bloodline's ruler, at c1: allowed, Tents is discarded and Roving Terror moves to h1", () => {
        const s = atC1({ rhysAt: 'c1', turn: 'rhys' })
        expect(legalChoices(s, 'rhys', rovingPower)[0].options).toEqual([card(TENTS)])
        expect(reasonCannotUse(s, 'rhys', [card(TENTS)])).toBeUndefined()
        actionPowerUse('rhys', ROVING, [card(TENTS)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(s.denizensBySite['h1']).toEqual([ROVING])
    })

    it('without Ancient Bloodline Dana uses it as before (control)', () => {
        const s = atC1({ bloodline: false })
        actionPowerUse('dana', ROVING, [card(TENTS)]).apply(s)
        expect(s.denizensBySite['h1']).toEqual([ROVING])
    })

    it("with the Great Slum's second discard at the destination: refused for Dana, allowed for Rhys", () => {
        const slum = { sites: { c1: [ROVING], h1: [TENTS, WOLVES] }, siteCards: { h1: 'site.great-slums' } }
        const s = board(slum)
        expect(legalChoices(s, 'dana', rovingPower).map((legal) => legal.options.length)).toEqual([0, 2])
        const before = JSON.stringify(s.dehydrate())
        expect(() => actionPowerUse('dana', ROVING, [card(TENTS), card(WOLVES)]).apply(s)).toThrow(/^Cannot use action power/)
        expect(JSON.stringify(s.dehydrate())).toBe(before)
        const ruler = board({ ...slum, rhysAt: 'c1', turn: 'rhys' })
        actionPowerUse('rhys', ROVING, [card(TENTS), card(WOLVES)]).apply(ruler)
        expect(ruler.denizensBySite['h1']).toEqual([ROVING])
    })

    it('before revision 16 a recorded game replays as it was recorded: Dana moves it out of c1', () => {
        const s = atC1({ revision: OathRevision.EngineFixes11 })
        actionPowerUse('dana', ROVING, [card(TENTS)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(s.denizensBySite['h1']).toEqual([ROVING])
    })
})

describe('Enchantress at a site does not swap itself out where it is locked for its user (R-7.2.2)', () => {
    // An adviser-only card reaches no site in a legal game (every move of an adviser to a site refuses one); the
    // power's site branch is guarded all the same.
    const atC1 = (extra: Parameters<typeof board>[0] = {}) =>
        board({ sites: { c1: [ENCHANTRESS], h1: [] }, dana: { advisers: [{ cardId: SCOUTS, faceUp: true }] }, ...extra })

    it('Dana at c1, which Rhys rules with Ancient Bloodline: nothing to pick', () => {
        const s = atC1()
        expect(legalChoices(s, 'dana', enchantressPower)[0].options).toEqual([])
        expect(() => actionPowerUse('dana', ENCHANTRESS, [card(SCOUTS)]).apply(s)).toThrow(/not among the options/)
        expect(s.denizensBySite['c1']).toEqual([ENCHANTRESS])
    })

    it("Rhys, Bloodline's ruler, swaps it with Dana's Scouts", () => {
        const s = atC1({ rhysAt: 'c1', turn: 'rhys' })
        actionPowerUse('rhys', ENCHANTRESS, [card(SCOUTS)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([SCOUTS])
        expect(s.getPlayerState('dana').faceupAdviserIds()).toEqual([ENCHANTRESS])
    })

    it('held as an adviser it is locked by nothing and swaps as before', () => {
        const s = board({ sites: { c1: [] }, dana: { advisers: [{ cardId: ENCHANTRESS, faceUp: true }] }, rhys: { advisers: [{ cardId: BLOODLINE, faceUp: true }, { cardId: SCOUTS, faceUp: true }] } })
        actionPowerUse('dana', ENCHANTRESS, [card(SCOUTS)]).apply(s)
        expect(s.getPlayerState('dana').faceupAdviserIds()).toEqual([SCOUTS])
    })

    it('before revision 16, as recorded', () => {
        const s = atC1({ revision: OathRevision.EngineFixes11 })
        actionPowerUse('dana', ENCHANTRESS, [card(SCOUTS)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([SCOUTS])
    })
})

describe('the locks already honoured stay as they were (controls)', () => {
    it("Threatening Roar played to c1 under Rhys's Bloodline stays: its self-discard honours the lock", () => {
        const s = board()
        resolve(s, { playerId: 'dana', keptCardId: ROAR, discardOrder: [FILLER], play: SearchPlay.Site, choices: [] })
        expect(s.denizensBySite['c1']).toEqual([ROAR])
    })

    it('Great Herd never names a printed-locked card (Marriage) or one at a Bloodline-ruled site', () => {
        const s = board({ bloodline: true, sites: { c1: [TENTS], c2: [], h1: [MARRIAGE] }, danaAt: 'c2' })
        expect(herdOffer(s, 'dana')).toEqual([])
    })

    it('Salt the Earth is not played to c1 under Bloodline, as before', () => {
        const s = board({ sites: { c1: [WOLVES], h1: [] } })
        expect(refusalOf(s, { playerId: 'dana', keptCardId: SALT, discardOrder: [FILLER], play: SearchPlay.Site, choices: [] })).toBe(
            'Salt the Earth cannot be played to a site with any locked cards'
        )
    })

    it("Horned Mask swaps none of the cards at c1 for Dana under Rhys's Bloodline, and Rhys's own swap works", () => {
        const s = board({ sites: { c1: [WOLVES], h1: [] }, dana: { relicIds: [HORNED_MASK], advisers: [{ cardId: SCOUTS, faceUp: true }] } })
        const mask = required(powersWithTiming(HORNED_MASK, PowerTiming.Action)[0], 'Horned Mask Action')
        expect(legalChoices(s, 'dana', mask)[1].options).toEqual([])
        const ruler = board({ sites: { c1: [WOLVES], h1: [] }, rhysAt: 'c1', turn: 'rhys', rhys: { relicIds: [HORNED_MASK], advisers: [{ cardId: BLOODLINE, faceUp: true }, { cardId: SCOUTS, faceUp: true }] } })
        actionPowerUse('rhys', HORNED_MASK, [card(SCOUTS), card(WOLVES)]).apply(ruler)
        expect(ruler.denizensBySite['c1']).toEqual([SCOUTS])
    })
})

describe("on the player's own view, where host-only values cannot be read", () => {
    const ownView = (s: HydratedOathGameState, playerId: string) => {
        const view: Visibility.Perspective = { kind: 'player', playerId }
        return OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
    }
    function sameOnOwnView<T>(s: HydratedOathGameState, playerId: string, check: (state: HydratedOathGameState) => T, expected: T) {
        const server = JSON.stringify(s.dehydrate())
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s, playerId))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    }

    it("Great Herd's offer and check read the same on Dana's own view", () => {
        const s = board({ dana: { handIds: [HERD, FILLER] }, rhys: { advisers: [{ cardId: BLOODLINE, faceUp: true }, { cardId: WOLVES, faceUp: false }] } })
        sameOnOwnView(s, 'dana', (state) => herdOffer(state, 'dana'), [])
        sameOnOwnView(s, 'dana', (state) => refusalOf(state, herdPlay('dana', { choices: [card(TENTS)] })), herdLockedAt('c1'))
        const free = board({ state: favorHeld('dana') })
        sameOnOwnView(free, 'dana', (state) => herdOffer(state, 'dana', 'c2'), [card(TENTS)])
    })

    it("Roving Terror's and Enchantress's domains read the same on Dana's own view", () => {
        const s = board({ sites: { c1: [ROVING], h1: [TENTS] }, rhys: { advisers: [{ cardId: BLOODLINE, faceUp: true }, { cardId: WOLVES, faceUp: false }] } })
        sameOnOwnView(s, 'dana', (state) => legalChoices(state, 'dana', rovingPower)[0].options, [])
        const enchantress = board({ sites: { c1: [ENCHANTRESS], h1: [] }, dana: { advisers: [{ cardId: SCOUTS, faceUp: true }] } })
        sameOnOwnView(enchantress, 'dana', (state) => legalChoices(state, 'dana', enchantressPower)[0].options, [])
    })
})
