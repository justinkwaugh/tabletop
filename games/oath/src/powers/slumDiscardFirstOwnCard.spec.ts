import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, card, site } from '../testing/choices.js'
import { INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import './index.js'

// The Great Slum (R-11.10): "When playing or moving a card to this site, you may discard a card here first." The card
// whose power moves a card there is never the one discarded first, as Great Herd is never discarded by its own swap
// (R-11.10-H1). From revision 33 Homesteaders and Resettle at the Great Slum leave themselves out of the cards they
// offer to discard first, so naming themselves is refused before anything is paid; before revision 33 a game keeps
// the use it was recorded with.

const HOMESTEADERS = 'denizen.hearth.homesteaders'
const RESETTLE = 'denizen.nomad.resettle'
const MARRIAGE = 'denizen.hearth.marriage'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const ALCHEMIST = 'denizen.arcane.alchemist'

const DANA = 'dana'
const RHYS = 'rhys'
const FIXED = OathRevision.EngineFixes28
const BEFORE = OathRevision.EngineFixes27
/** The refusal of a card the discard-first choice does not offer, given before anything is paid. */
const NOT_OFFERED = /is not among the options for a denizen at the Great Slum to discard first/

interface Table {
    revision: OathRevision
    /** The denizens at c1, the Great Slum, where Dana stands and rules with a warband. */
    atC1: string[]
    /** Dana's faceup advisers. */
    advisers: string[]
    /** The denizens at c2, the River, which Dana rules too. */
    atC2?: string[]
}

function table({ revision, atC1, advisers, atC2 = [] }: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'p1', favor: 3, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: atC1, c2: atC2, p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 }, c2: { [DANA]: 1 } },
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

/** Homesteaders at the full Great Slum, with the Inn among Dana's advisers. */
const homesteadersAtSlum = (revision: OathRevision, atC1 = [HOMESTEADERS, WOLVES, TENTS]) =>
    table({ revision, atC1, advisers: [INN] })
/** Resettle at the full Great Slum, with the Tents (a Nomad card) among Dana's advisers. */
const resettleAtSlum = (revision: OathRevision, atC1 = [RESETTLE, WOLVES, SCOUTS]) =>
    table({ revision, atC1, advisers: [TENTS] })

const homesteadersUse = (first?: string): PowerChoice[] => [
    card(INN),
    ...(first ? [card(first)] : [])
]
const resettleUse = (first?: string): PowerChoice[] => [
    card(TENTS),
    site('c1'),
    ...(first ? [card(first)] : [])
]

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
function expectRefusedUnchanged(s: HydratedOathGameState, cardId: string, choices: PowerChoice[]) {
    expect(reasonFor(s, cardId, choices)).toMatch(NOT_OFFERED)
    const before = JSON.stringify(s.dehydrate())
    expect(() => actionPowerUse(DANA, cardId, choices).apply(s)).toThrow(NOT_OFFERED)
    expect(JSON.stringify(s.dehydrate())).toBe(before)
}

describe('Homesteaders at the Great Slum, naming itself to discard first (R-11.10)', () => {
    it('setup: c1 is at its capacity of 3, and Dana may use Homesteaders there', () => {
        const s = homesteadersAtSlum(FIXED)
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
        expect(reasonFor(s, HOMESTEADERS, homesteadersUse(WOLVES))).toBeUndefined()
    })

    it('from revision 33 Homesteaders is not offered to discard first; the Wolves and Tents are', () => {
        expect(offeredFirst(homesteadersAtSlum(FIXED), HOMESTEADERS)).toEqual([WOLVES, TENTS])
    })

    it('from revision 33 naming Homesteaders itself is refused, and nothing is paid, discarded or moved', () => {
        const s = homesteadersAtSlum(FIXED)
        expectRefusedUnchanged(s, HOMESTEADERS, homesteadersUse(HOMESTEADERS))
        expect(s.denizensAt('c1')).toEqual([HOMESTEADERS, WOLVES, TENTS])
        expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(true)
    })

    it('from revision 33, at a Great Slum with room, naming itself is refused too, and naming nothing moves the Inn in', () => {
        const s = homesteadersAtSlum(FIXED, [HOMESTEADERS, WOLVES])
        expect(offeredFirst(s, HOMESTEADERS)).toEqual([WOLVES])
        expectRefusedUnchanged(s, HOMESTEADERS, homesteadersUse(HOMESTEADERS))
        actionPowerUse(DANA, HOMESTEADERS, homesteadersUse()).apply(s)
        expect(s.denizensAt('c1')).toEqual([HOMESTEADERS, WOLVES, INN])
    })

    it('control: another card there named first is discarded, and the Inn moves in, at revision 33 and 32', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = homesteadersAtSlum(revision)
            actionPowerUse(DANA, HOMESTEADERS, homesteadersUse(WOLVES)).apply(s)
            expect(s.denizensAt('c1')).toEqual([HOMESTEADERS, TENTS, INN])
            expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(false)
        }
    })

    it('control: a locked card is still refused at revision 33', () => {
        const s = homesteadersAtSlum(FIXED, [HOMESTEADERS, MARRIAGE, WOLVES])
        expect(offeredFirst(s, HOMESTEADERS)).not.toContain(MARRIAGE)
        expectRefusedUnchanged(s, HOMESTEADERS, homesteadersUse(MARRIAGE))
    })

    it('before revision 33 Homesteaders is offered and accepted as the game was recorded: it goes, the Inn takes its space', () => {
        const s = homesteadersAtSlum(BEFORE)
        expect(offeredFirst(s, HOMESTEADERS)).toEqual([HOMESTEADERS, WOLVES, TENTS])
        expect(reasonFor(s, HOMESTEADERS, homesteadersUse(HOMESTEADERS))).toBeUndefined()
        actionPowerUse(DANA, HOMESTEADERS, homesteadersUse(HOMESTEADERS)).apply(s)
        expect(s.denizensAt('c1')).toEqual([WOLVES, TENTS, INN])
    })
})

describe('Homesteaders not at the Great Slum (unchanged)', () => {
    it('used from Dana’s advisers: every card at the Great Slum is offered, at revision 33 and 32', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({
                revision,
                atC1: [WOLVES, TENTS, SCOUTS],
                advisers: [HOMESTEADERS, INN]
            })
            expect(offeredFirst(s, HOMESTEADERS)).toEqual([WOLVES, TENTS, SCOUTS])
            actionPowerUse(DANA, HOMESTEADERS, homesteadersUse(WOLVES)).apply(s)
            expect(s.denizensAt('c1')).toEqual([TENTS, SCOUTS, INN])
        }
    })

    it('used at the River, which Dana rules: every card at the Great Slum is offered, at revision 33 and 32', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({
                revision,
                atC1: [WOLVES, TENTS, SCOUTS],
                advisers: [INN],
                atC2: [HOMESTEADERS]
            })
            expect(offeredFirst(s, HOMESTEADERS)).toEqual([WOLVES, TENTS, SCOUTS])
            actionPowerUse(DANA, HOMESTEADERS, homesteadersUse(SCOUTS)).apply(s)
            expect(s.denizensAt('c1')).toEqual([WOLVES, TENTS, INN])
            expect(s.denizensAt('c2')).toEqual([HOMESTEADERS])
        }
    })
})

describe('Resettle at the Great Slum, naming itself to discard first (R-11.10)', () => {
    it('from revision 33 Resettle is not offered to discard first; the Wolves and Scouts are', () => {
        expect(offeredFirst(resettleAtSlum(FIXED), RESETTLE)).toEqual([WOLVES, SCOUTS])
    })

    it('from revision 33 naming Resettle itself is refused, and nothing is paid, discarded or moved', () => {
        const s = resettleAtSlum(FIXED)
        expectRefusedUnchanged(s, RESETTLE, resettleUse(RESETTLE))
        expect(s.denizensAt('c1')).toEqual([RESETTLE, WOLVES, SCOUTS])
        expect(s.getPlayerState(DANA).hasAdviser(TENTS)).toBe(true)
    })

    it('from revision 33, at a Great Slum with room, naming itself is refused too, and naming nothing moves the Tents in', () => {
        const s = resettleAtSlum(FIXED, [RESETTLE, WOLVES])
        expectRefusedUnchanged(s, RESETTLE, resettleUse(RESETTLE))
        actionPowerUse(DANA, RESETTLE, resettleUse()).apply(s)
        expect(s.denizensAt('c1')).toEqual([RESETTLE, WOLVES, TENTS])
    })

    it('control: another card there named first is discarded, and the Tents move in, at revision 33 and 32', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = resettleAtSlum(revision)
            actionPowerUse(DANA, RESETTLE, resettleUse(SCOUTS)).apply(s)
            expect(s.denizensAt('c1')).toEqual([RESETTLE, WOLVES, TENTS])
        }
    })

    it('used at the River, which Dana rules, moving to the Great Slum: every card there is offered, at revision 33 and 32', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({
                revision,
                atC1: [WOLVES, SCOUTS, INN],
                advisers: [TENTS],
                atC2: [RESETTLE]
            })
            expect(offeredFirst(s, RESETTLE)).toEqual([WOLVES, SCOUTS, INN])
            actionPowerUse(DANA, RESETTLE, resettleUse(INN)).apply(s)
            expect(s.denizensAt('c1')).toEqual([WOLVES, SCOUTS, TENTS])
        }
    })

    it('before revision 33 Resettle is offered and accepted as the game was recorded: it goes, the Tents take its space', () => {
        const s = resettleAtSlum(BEFORE)
        expect(offeredFirst(s, RESETTLE)).toEqual([RESETTLE, WOLVES, SCOUTS])
        expect(reasonFor(s, RESETTLE, resettleUse(RESETTLE))).toBeUndefined()
        actionPowerUse(DANA, RESETTLE, resettleUse(RESETTLE)).apply(s)
        expect(s.denizensAt('c1')).toEqual([WOLVES, SCOUTS, TENTS])
    })
})

describe('undo after the move', () => {
    it('the use with another card discarded first undoes to the state before it, at revision 33 and 32', () => {
        const game = {
            ...testGame([DANA, RHYS, 'chancellor']),
            protectedInformation: true as const
        }
        for (const [s, cardId, choices] of [
            [homesteadersAtSlum(FIXED), HOMESTEADERS, homesteadersUse(WOLVES)],
            [resettleAtSlum(FIXED), RESETTLE, resettleUse(WOLVES)],
            [homesteadersAtSlum(BEFORE), HOMESTEADERS, homesteadersUse(HOMESTEADERS)]
        ] as const) {
            const start = s.dehydrate()
            const action = buildAction(UseActionPower, {
                playerId: DANA,
                cardId,
                powerIndex: powerIndexOf(cardId, PowerTiming.Action),
                choices: [...choices]
            })
            const result = engine.executeCanonicalAction({
                action: { ...action, id: `e-${start.actionCount}`, index: start.actionCount },
                state: start,
                game
            })
            const after = new HydratedOathGameState(result.updatedState as never)
            expect(after.denizensAt('c1')).not.toEqual(s.denizensAt('c1'))
            let view = result.updatedState
            for (const a of result.processedActions.toReversed())
                view = engine.undoProcessedAction({ state: view, action: a })
            expect(view).toEqual(start)
        }
    })
})

describe("on Dana's own view", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    it('the same offers and answers, with the state neither copied nor changed', () => {
        for (const [s, cardId, choices, refused] of [
            [homesteadersAtSlum(FIXED), HOMESTEADERS, homesteadersUse(HOMESTEADERS), true],
            [homesteadersAtSlum(BEFORE), HOMESTEADERS, homesteadersUse(HOMESTEADERS), false],
            [homesteadersAtSlum(FIXED), HOMESTEADERS, homesteadersUse(WOLVES), false],
            [resettleAtSlum(FIXED), RESETTLE, resettleUse(RESETTLE), true],
            [resettleAtSlum(BEFORE), RESETTLE, resettleUse(RESETTLE), false],
            [resettleAtSlum(FIXED), RESETTLE, resettleUse(WOLVES), false]
        ] as const) {
            s.getPlayerState(RHYS).handIds = [ALCHEMIST]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = ownView(s)
            expect(offeredFirst(view, cardId)).toEqual(offeredFirst(s, cardId))
            expect(reasonFor(view, cardId, [...choices])).toBe(reasonFor(s, cardId, [...choices]))
            expect(reasonFor(view, cardId, [...choices]) !== undefined).toBe(refused)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})
