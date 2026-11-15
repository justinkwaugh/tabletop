import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, card, modifierUse } from '../testing/choices.js'
import { FILLER } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import './index.js'

// Roving Terror: "Action: Discard a denizen card at any other site and move this card there." Law 10.15 makes the
// move part of the power, and a move follows the site's capacity (Law 2.8.1). From revision 31 a salted site can
// keep a modifier in use beside Salt the Earth, two cards at capacity 1, so the move there cannot happen.

const SALT = 'denizen.discord.salt-the-earth'
const WELCOMING = 'denizen.hearth.welcoming-party'
const ROVING = 'denizen.beast.roving-terror'
const RANGERS = 'denizen.beast.rangers'
const WOLVES = 'denizen.beast.wolves'

const DANA = 'dana'
const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle
const POWER = powerIndexOf(ROVING, PowerTiming.Action)

/**
 * Dana stands at c2 with Roving Terror and 2 secrets; Rhys at c1, which holds `atC1`. With `salted`, c1 has Salt
 * the Earth's capacity of 1.
 */
function table(
    revision: OathRevision,
    atC1: string[],
    { salted = true, c1Card }: { salted?: boolean; c1Card?: string } = {}
): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: DANA, color: Color.Red, siteId: 'c2', favor: 3, secrets: 2 }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c1', favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: atC1, c2: [ROVING], p1: [], h1: [] },
            warbandsBySite: { c1: { rhys: 1 }, c2: { dana: 1 } },
            siteCapacityOverrides: salted ? { c1: 1 } : {}
        }
    )
    if (c1Card) s.siteCards = { ...s.siteCards, c1: c1Card }
    openTurn(s, DANA)
    return s
}

const reasonFor = (s: HydratedOathGameState, choices: PowerChoice[]) =>
    HydratedUseActionPower.reasonCannotUse(s, DANA, ROVING, POWER, choices)

/** The denizens Dana's Roving Terror offers to discard. */
function offeredTargets(s: HydratedOathGameState): string[] {
    const power = cardPower(ROVING, POWER)
    if (!power) throw Error(`${ROVING} prints no Action power`)
    const [targets] = offeredChoices(s, DANA, power)
    return targets.options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

describe("Roving Terror's move needs a space at its target's site once the target is discarded (Law 10.15, 2.8.1)", () => {
    it('through a Search: Salt the Earth keeps Welcoming Party in use, and Roving Terror is then refused there', () => {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: DANA,
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 6,
                    secrets: 2,
                    supply: 7
                }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2 })
            ]),
            {
                oathRevision: FIXED,
                denizensBySite: { c1: [WELCOMING, WOLVES], c2: [ROVING], p1: [], h1: [] },
                warbandsBySite: { c1: { [DANA]: 1 }, c2: { [DANA]: 1 } }
            }
        )
        openTurn(s, DANA)
        s.requireVault().worldDeck = [SALT, FILLER, FILLER]
        new HydratedSearch(
            buildAction(Search, {
                playerId: DANA,
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers: [modifierUse(WELCOMING)]
            })
        ).apply(s)
        new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: SALT,
                discardOrder: [FILLER, FILLER],
                play: SearchPlay.Site
            })
        ).apply(s)
        expect([...s.denizensAt('c1')].sort()).toEqual([SALT, WELCOMING].sort())
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)

        expect(offeredTargets(s)).not.toContain(WELCOMING)
        expect(reasonFor(s, [card(WELCOMING)])).toBeDefined()
    })

    it('from revision 31, on Welcoming Party at the salted site: not offered, refused, and nothing is paid', () => {
        const s = table(FIXED, [SALT, WELCOMING])
        expect(offeredTargets(s)).toEqual([])
        expect(reasonFor(s, [card(WELCOMING)])).toBeDefined()

        const before = JSON.stringify(s.dehydrate())
        expect(() => actionPowerUse(DANA, ROVING, [card(WELCOMING)]).apply(s)).toThrow()
        expect(JSON.stringify(s.dehydrate())).toBe(before)
        expect(s.getPlayerState(DANA).secrets).toBe(2)
        expect(s.denizensAt('c1')).toEqual([SALT, WELCOMING])
    })

    it('on a site with room once the target is discarded, accepted as before: at capacity, one for one', () => {
        const s = table(FIXED, [WELCOMING, WOLVES, RANGERS], { salted: false })
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
        expect(offeredTargets(s)).toEqual([WELCOMING, WOLVES, RANGERS])
        expect(reasonFor(s, [card(WELCOMING)])).toBeUndefined()
        actionPowerUse(DANA, ROVING, [card(WELCOMING)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([WOLVES, RANGERS, ROVING])
        expect(s.denizensAt('c2')).toEqual([])
        expect(s.getPlayerState(DANA).secrets).toBe(1)
    })

    it('on Salt the Earth itself, refused as before: it is locked', () => {
        const fixed = reasonFor(table(FIXED, [SALT]), [card(SALT)])
        expect(fixed).toBeDefined()
        expect(fixed).toBe(reasonFor(table(BEFORE, [SALT]), [card(SALT)]))
        expect(offeredTargets(table(FIXED, [SALT]))).toEqual([])
    })

    it('before revision 31 a game keeps the move it was recorded with: Roving Terror moves in', () => {
        const s = table(BEFORE, [SALT, WELCOMING])
        expect(offeredTargets(s)).toEqual([WELCOMING])
        expect(reasonFor(s, [card(WELCOMING)])).toBeUndefined()
        actionPowerUse(DANA, ROVING, [card(WELCOMING)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([SALT, ROVING])
    })
})

// The Great Slum: "[card] → [discard] / [playOrMoveHere]" (R-11.10). Roving Terror may discard a second card there
// first, which frees a space too. Constructed over the printed capacity of 3, to reach the count.
describe("the Great Slum's discard first frees a space for Roving Terror (R-11.10)", () => {
    const slum = (revision: OathRevision) =>
        table(revision, [WELCOMING, WOLVES, RANGERS, FILLER], {
            salted: false,
            c1Card: 'site.great-slums'
        })

    it('from revision 31 the target alone leaves no space; with a card discarded first it is accepted', () => {
        const s = slum(FIXED)
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
        expect(offeredTargets(s)).toEqual([WELCOMING, WOLVES, RANGERS, FILLER])
        expect(reasonFor(s, [card(WELCOMING)])).toBe('site c1 is at its capacity of 3')
        expect(reasonFor(s, [card(WELCOMING), card(WOLVES)])).toBeUndefined()
        actionPowerUse(DANA, ROVING, [card(WELCOMING), card(WOLVES)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([RANGERS, FILLER, ROVING])
    })

    it('before revision 31 the target alone is accepted', () => {
        expect(reasonFor(slum(BEFORE), [card(WELCOMING)])).toBeUndefined()
    })
})

describe("on Dana's own view", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    it('the same offers and answers, with the state neither copied nor changed', () => {
        for (const [s, refused] of [
            [table(FIXED, [SALT, WELCOMING]), true],
            [table(BEFORE, [SALT, WELCOMING]), false],
            [table(FIXED, [WELCOMING, WOLVES], { salted: false }), false]
        ] as const) {
            s.getPlayerState('rhys').handIds = [WOLVES]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = ownView(s)
            expect(offeredTargets(view)).toEqual(offeredTargets(s))
            expect(offeredTargets(view).includes(WELCOMING)).toBe(!refused)
            expect(reasonFor(view, [card(WELCOMING)])).toBe(reasonFor(s, [card(WELCOMING)]))
            expect(reasonFor(view, [card(WELCOMING)]) !== undefined).toBe(refused)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})
