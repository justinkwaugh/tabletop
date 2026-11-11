import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from '../actions/searchResolve.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    openTurn,
    testPlayer,
    testState,
    testVaultWithRelics,
    withChancellor
} from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, card, site } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { discardFirstReach } from '../util/cardPlay.js'
import { greatSlumDenizensToDiscardFirst } from '../util/sitePowers.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import './index.js'

// The Great Slum (R-11.10): "When playing or moving a card to this site, you may discard a card here first." A
// discard puts the card "on top of the ... discard pile" (Law 10.5), and a discard pile holds "denizen and Vision
// cards" (Law 2.1.2); a relic goes back to the relic deck and has no discard pile. So the card discarded first is
// one of the denizens there: a relic at the Great Slum is never offered, and naming it is refused, for a Search's
// site play and for a power's move there alike.

const HOMESTEADERS = 'denizen.hearth.homesteaders'
const RESETTLE = 'denizen.nomad.resettle'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const ALCHEMIST = 'denizen.arcane.alchemist'
const CAPTAINS = 'denizen.order.captains'
const CAGE = 'relic.obsidian-cage'
/** The relic's slot at c1: its count is public, its identity is in the vault (R-2.8.2). */
const SLOT = 'c1-r1'

const DANA = 'dana'
const RHYS = 'rhys'
const REVISIONS = [OathRevision.EngineFixes28, OathRevision.EngineFixes27]
const NOT_REACHED =
    "only the Great Slum, Crop Rotation, or holding the People's Favor, lets a card be discarded first"
const NOT_OFFERED = /is not among the options for a denizen at the Great Slum to discard first/

/**
 * Dana (Exile) stands at c1, the Great Slum, which holds `atC1` and one relic (the Obsidian Cage) and which Dana rules
 * with a warband. Dana holds `advisers` faceup; nobody holds the People's Favor.
 */
function table(
    revision: OathRevision,
    atC1: string[],
    advisers: string[] = []
): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'p1', favor: 3, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: atC1, c2: [], p1: [], h1: [] },
            relicsBySite: { c1: [{ slotId: SLOT }] },
            vault: testVaultWithRelics({ [SLOT]: CAGE }),
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, DANA)
    return s
}

describe('setup', () => {
    it('the Great Slum holds the relic in its slot, beside the denizens', () => {
        const s = table(OathRevision.EngineFixes28, [WOLVES, TENTS, SCOUTS])
        expect(s.relicSlotsAt('c1')).toEqual([{ slotId: SLOT }])
        expect(s.requireVault().relicFacedown[SLOT]).toBe(CAGE)
        expect(s.denizensAt('c1')).toEqual([WOLVES, TENTS, SCOUTS])
    })
})

describe("a Search's site play to the Great Slum: a relic there is not discarded first", () => {
    /** Dana has searched the world deck, drawing Alchemist, Wrestlers and Captains. */
    function searched(revision: OathRevision, atC1: string[]): HydratedOathGameState {
        const s = table(revision, atC1)
        s.requireVault().worldDeck = [ALCHEMIST, FILLER, CAPTAINS]
        new HydratedSearch(
            buildAction(Search, {
                playerId: DANA,
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers: []
            })
        ).apply(s)
        return s
    }
    /** Alchemist kept and played to the Great Slum, discarding `first` first. */
    const kept = (first?: string): SearchResolveChoice => ({
        keptCardId: ALCHEMIST,
        discardOrder: [FILLER, CAPTAINS],
        play: SearchPlay.Site,
        ...(first ? { discardFirstCardId: first } : {})
    })
    const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
        HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

    for (const revision of REVISIONS) {
        it(`revision ${revision}: only the denizens there are offered to discard first`, () => {
            const reach = discardFirstReach(searched(revision, [WOLVES, TENTS, SCOUTS]), DANA, {})
            expect(reach.cardIds).toEqual([WOLVES, TENTS, SCOUTS])
            expect(reach.cardIds).not.toContain(SLOT)
            expect(reach.cardIds).not.toContain(CAGE)
        })

        it(`revision ${revision}: the relic named by its slot or by its card is refused, in the list too`, () => {
            const s = searched(revision, [WOLVES, TENTS, SCOUTS])
            expect(checkOf(s, kept(SLOT))).toBe(NOT_REACHED)
            expect(checkOf(s, kept(CAGE))).toBe(NOT_REACHED)
            expect(
                checkOf(s, {
                    ...kept(),
                    discardFirstCardIds: [CAGE]
                })
            ).toBe(NOT_REACHED)
        })

        it(`revision ${revision}: with room, naming the relic is refused too, and the relic stays`, () => {
            const s = searched(revision, [WOLVES])
            expect(checkOf(s, kept(CAGE))).toBe(NOT_REACHED)
            expect(checkOf(s, kept())).toBeUndefined()
            expect(s.relicSlotsAt('c1')).toEqual([{ slotId: SLOT }])
        })

        it(`revision ${revision}: control: a denizen there goes first, Alchemist arrives, and the relic stays`, () => {
            const s = searched(revision, [WOLVES, TENTS, SCOUTS])
            expect(checkOf(s, kept(WOLVES))).toBeUndefined()
            new HydratedSearchResolve(
                buildAction(SearchResolve, { playerId: DANA, ...kept(WOLVES) })
            ).apply(s)
            expect(s.denizensAt('c1')).toEqual([TENTS, SCOUTS, ALCHEMIST])
            expect(s.relicSlotsAt('c1')).toEqual([{ slotId: SLOT }])
            expect(s.requireVault().relicFacedown[SLOT]).toBe(CAGE)
        })
    }
})

describe('a power that moves a card to the Great Slum: a relic there is not discarded first', () => {
    /** The cards `cardId`'s Action power offers to discard first at the Great Slum (its last choice). */
    function offeredFirst(s: HydratedOathGameState, cardId: string): string[] {
        const power = cardPower(cardId, powerIndexOf(cardId, PowerTiming.Action))
        if (!power) throw Error(`${cardId} prints no Action power`)
        const offered = offeredChoices(s, DANA, power)
        return offered[offered.length - 1].options.flatMap((option) =>
            option.kind === PowerChoiceKind.Card ? [option.cardId] : []
        )
    }
    const reasonFor = (s: HydratedOathGameState, cardId: string, choices: PowerChoice[]) =>
        HydratedUseActionPower.reasonCannotUse(
            s,
            DANA,
            cardId,
            powerIndexOf(cardId, PowerTiming.Action),
            choices
        )
    /** The use is refused as not offered, and the state is exactly as it was: nothing paid, discarded or moved. */
    function expectRefusedUnchanged(
        s: HydratedOathGameState,
        cardId: string,
        choices: PowerChoice[]
    ) {
        expect(reasonFor(s, cardId, choices)).toMatch(NOT_OFFERED)
        const before = JSON.stringify(s.dehydrate())
        expect(() => actionPowerUse(DANA, cardId, choices).apply(s)).toThrow(NOT_OFFERED)
        expect(JSON.stringify(s.dehydrate())).toBe(before)
    }

    for (const revision of REVISIONS) {
        it(`revision ${revision}: every route's list is the denizens there, never the relic`, () => {
            const s = table(revision, [WOLVES, TENTS, SCOUTS])
            // Homesteaders, Resettle, Roving Terror and the swaps read this list.
            expect(greatSlumDenizensToDiscardFirst(s, DANA, 'c1')).toEqual([WOLVES, TENTS, SCOUTS])
        })

        it(`revision ${revision}: Homesteaders, used from Dana's advisers, offers the denizens only and refuses the relic`, () => {
            const s = table(revision, [WOLVES, TENTS, SCOUTS], [HOMESTEADERS, INN])
            expect(offeredFirst(s, HOMESTEADERS)).toEqual([WOLVES, TENTS, SCOUTS])
            expectRefusedUnchanged(s, HOMESTEADERS, [card(INN), card(SLOT)])
            expectRefusedUnchanged(s, HOMESTEADERS, [card(INN), card(CAGE)])
            expect(s.relicSlotsAt('c1')).toEqual([{ slotId: SLOT }])
            expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(true)
        })

        it(`revision ${revision}: Homesteaders at the full Great Slum offers the other denizens only and refuses the relic`, () => {
            const s = table(revision, [HOMESTEADERS, WOLVES, TENTS], [INN])
            expect(offeredFirst(s, HOMESTEADERS)).not.toContain(SLOT)
            expect(offeredFirst(s, HOMESTEADERS)).not.toContain(CAGE)
            expectRefusedUnchanged(s, HOMESTEADERS, [card(INN), card(CAGE)])
        })

        it(`revision ${revision}: control: Homesteaders discards a denizen first, the Inn arrives, and the relic stays`, () => {
            const s = table(revision, [WOLVES, TENTS, SCOUTS], [HOMESTEADERS, INN])
            actionPowerUse(DANA, HOMESTEADERS, [card(INN), card(WOLVES)]).apply(s)
            expect(s.denizensAt('c1')).toEqual([TENTS, SCOUTS, INN])
            expect(s.relicSlotsAt('c1')).toEqual([{ slotId: SLOT }])
        })

        it(`revision ${revision}: Resettle, moving the Tents to the Great Slum, offers the denizens only and refuses the relic`, () => {
            const s = table(revision, [WOLVES, SCOUTS, INN], [RESETTLE, TENTS])
            expect(offeredFirst(s, RESETTLE)).toEqual([WOLVES, SCOUTS, INN])
            expectRefusedUnchanged(s, RESETTLE, [card(TENTS), site('c1'), card(CAGE)])
            expectRefusedUnchanged(s, RESETTLE, [card(TENTS), site('c1'), card(SLOT)])
        })
    }
})
