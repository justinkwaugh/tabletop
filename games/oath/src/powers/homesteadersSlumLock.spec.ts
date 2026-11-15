import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { actionPowerUse, card } from '../testing/choices.js'
import { INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { isLockedFor } from '../util/locked.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import './index.js'

// The Great Slum (R-11.10) lets a card there be discarded before one is moved there. Law 7.2.2: a locked card
// "cannot be discarded, moved, or swapped", so a locked card (printed locked, Salt the Earth, or locked by an
// enemy's Ancient Bloodline) is never the card Homesteaders discards first. From revision 31 it is not offered and
// is refused; before revision 31 a game keeps the use it was recorded with.

const HOMESTEADERS = 'denizen.hearth.homesteaders'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'
const MARRIAGE = 'denizen.hearth.marriage'
const SALT = 'denizen.discord.salt-the-earth'
const ROVING = 'denizen.beast.roving-terror'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'

const DANA = 'dana'
const RHYS = 'rhys'
const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle
const POWER = powerIndexOf(HOMESTEADERS, PowerTiming.Action)
/** The refusal of a card the discard-first choice does not offer, given before anything is paid. */
const NOT_OFFERED = /is not among the options for a denizen at the Great Slum to discard first/

interface Table {
    revision: OathRevision
    /** The denizens at c1, the Great Slum. */
    atC1: string[]
    /** Who uses Homesteaders, standing at c1 with it and the Inn among their advisers. */
    user?: string
    /** Rhys holds Ancient Bloodline and rules c1 with two warbands. */
    bloodline?: boolean
    /** c1 has Salt the Earth's capacity of 1. */
    salted?: boolean
    /** Dana is a Citizen and Rhys the Chancellor. */
    citizen?: boolean
}

function table({
    revision,
    atC1,
    user = DANA,
    bloodline = false,
    salted = false,
    citizen = false
}: Table): HydratedOathGameState {
    const homesteader = [
        { cardId: HOMESTEADERS, faceUp: true },
        { cardId: INN, faceUp: true }
    ]
    const players = [
        testPlayer({
            playerId: DANA,
            color: Color.Red,
            siteId: user === DANA ? 'c1' : 'c2',
            favor: 3,
            secrets: 2,
            status: citizen ? PlayerStatus.Citizen : PlayerStatus.Exile,
            advisers: user === DANA ? homesteader : []
        }),
        testPlayer({
            playerId: RHYS,
            color: Color.Blue,
            siteId: user === RHYS ? 'c1' : 'c2',
            favor: 3,
            secrets: 2,
            status: citizen ? PlayerStatus.Chancellor : PlayerStatus.Exile,
            advisers: [
                ...(user === RHYS ? homesteader : []),
                ...(bloodline ? [{ cardId: BLOODLINE, faceUp: true }] : [])
            ]
        })
    ]
    const s = testState(withChancellor(players), {
        oathRevision: revision,
        denizensBySite: { c1: atC1, c2: [], p1: [], h1: [] },
        warbandsBySite: bloodline ? { c1: { [RHYS]: 2 } } : {},
        siteCapacityOverrides: salted ? { c1: 1 } : {},
        siteCards: {
            c1: 'site.great-slums',
            c2: 'site.river',
            p1: 'site.marshes',
            h1: 'site.mountain'
        }
    })
    openTurn(s, user)
    return s
}

/** The cards Homesteaders offers to discard first at the Great Slum. */
function offeredFirst(s: HydratedOathGameState, playerId = DANA): string[] {
    const power = cardPower(HOMESTEADERS, POWER)
    if (!power) throw Error(`${HOMESTEADERS} prints no Action power`)
    const [, first] = offeredChoices(s, playerId, power)
    return first.options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

const reasonFor = (s: HydratedOathGameState, choices: PowerChoice[], playerId = DANA) =>
    HydratedUseActionPower.reasonCannotUse(s, playerId, HOMESTEADERS, POWER, choices)

/** The use is refused, and the state is exactly as it was. */
function expectRefusedUnchanged(s: HydratedOathGameState, choices: PowerChoice[]) {
    expect(reasonFor(s, choices)).toBeDefined()
    const before = JSON.stringify(s.dehydrate())
    expect(() => actionPowerUse(DANA, HOMESTEADERS, choices).apply(s)).toThrow()
    expect(JSON.stringify(s.dehydrate())).toBe(before)
}

describe('Homesteaders at a full Great Slum holding Marriage, printed locked (R-11.10, R-7.2.2)', () => {
    const atC1 = [MARRIAGE, WOLVES, TENTS]

    it('setup: Marriage is locked for Dana, and c1 is at its capacity of 3', () => {
        const s = table({ revision: FIXED, atC1 })
        expect(isLockedFor(s, DANA, MARRIAGE)).toBe(true)
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
    })

    it('from revision 31 Marriage is not offered to discard first; the Wolves and Tents are', () => {
        expect(offeredFirst(table({ revision: FIXED, atC1 }))).toEqual([WOLVES, TENTS])
    })

    it('from revision 31 naming Marriage is refused, and nothing is moved', () => {
        const s = table({ revision: FIXED, atC1 })
        expect(reasonFor(s, [card(INN), card(MARRIAGE)])).toMatch(NOT_OFFERED)
        expectRefusedUnchanged(s, [card(INN), card(MARRIAGE)])
        expect(s.denizensAt('c1')).toEqual(atC1)
        expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(true)
    })

    it('control: the Wolves are discarded first and the Inn moves in', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({ revision, atC1 })
            expect(reasonFor(s, [card(INN), card(WOLVES)])).toBeUndefined()
            actionPowerUse(DANA, HOMESTEADERS, [card(INN), card(WOLVES)]).apply(s)
            expect(s.denizensAt('c1')).toEqual([MARRIAGE, TENTS, INN])
            expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(false)
        }
    })

    it('before revision 31 Marriage is offered and accepted as the game was recorded: it stays, the Inn does not move', () => {
        const s = table({ revision: BEFORE, atC1 })
        expect(offeredFirst(s)).toEqual(atC1)
        expect(reasonFor(s, [card(INN), card(MARRIAGE)])).toBeUndefined()
        actionPowerUse(DANA, HOMESTEADERS, [card(INN), card(MARRIAGE)]).apply(s)
        expect(s.denizensAt('c1')).toEqual(atC1)
        expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(true)
    })
})

describe('Homesteaders at a salted Great Slum, holding Salt the Earth at its capacity of 1', () => {
    const atC1 = [SALT]

    it('setup: Salt the Earth is locked, and c1 has a capacity of 1', () => {
        const s = table({ revision: FIXED, atC1, salted: true })
        expect(isLockedFor(s, DANA, SALT)).toBe(true)
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
    })

    it('from revision 31 Salt the Earth is not offered, and naming it is refused', () => {
        const s = table({ revision: FIXED, atC1, salted: true })
        expect(offeredFirst(s)).toEqual([])
        expect(reasonFor(s, [card(INN), card(SALT)])).toMatch(NOT_OFFERED)
        expectRefusedUnchanged(s, [card(INN), card(SALT)])
    })

    it('with nothing discarded first the site has no room, as before', () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({ revision, atC1, salted: true })
            expect(reasonFor(s, [card(INN)])).toBe('your site has no room for another denizen')
        }
    })

    it('before revision 31 Salt the Earth is offered and accepted: it stays, the Inn does not move', () => {
        const s = table({ revision: BEFORE, atC1, salted: true })
        expect(offeredFirst(s)).toEqual([SALT])
        expect(reasonFor(s, [card(INN), card(SALT)])).toBeUndefined()
        actionPowerUse(DANA, HOMESTEADERS, [card(INN), card(SALT)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([SALT])
        expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(true)
    })
})

describe('Homesteaders at a Great Slum an enemy holding Ancient Bloodline rules', () => {
    const atC1 = [WOLVES, TENTS, SCOUTS]

    it('setup: every card at c1 is locked for Dana, and none for Rhys', () => {
        const s = table({ revision: FIXED, atC1, bloodline: true })
        expect(atC1.map((id) => isLockedFor(s, DANA, id))).toEqual([true, true, true])
        expect(atC1.map((id) => isLockedFor(s, RHYS, id))).toEqual([false, false, false])
    })

    it('from revision 31 none is offered, and naming one is refused', () => {
        const s = table({ revision: FIXED, atC1, bloodline: true })
        expect(offeredFirst(s)).toEqual([])
        expect(reasonFor(s, [card(INN), card(WOLVES)])).toMatch(NOT_OFFERED)
        expectRefusedUnchanged(s, [card(INN), card(WOLVES)])
    })

    it('before revision 31 each is offered and accepted: the Wolves stay, the Inn does not move', () => {
        const s = table({ revision: BEFORE, atC1, bloodline: true })
        expect(offeredFirst(s)).toEqual(atC1)
        expect(reasonFor(s, [card(INN), card(WOLVES)])).toBeUndefined()
        actionPowerUse(DANA, HOMESTEADERS, [card(INN), card(WOLVES)]).apply(s)
        expect(s.denizensAt('c1')).toEqual(atC1)
        expect(s.getPlayerState(DANA).hasAdviser(INN)).toBe(true)
    })

    it("control: Ancient Bloodline's holder names their own, and their adviser moves in", () => {
        for (const revision of [FIXED, BEFORE]) {
            const s = table({ revision, atC1, bloodline: true, user: RHYS })
            expect(offeredFirst(s, RHYS)).toEqual(atC1)
            expect(reasonFor(s, [card(INN), card(WOLVES)], RHYS)).toBeUndefined()
            actionPowerUse(RHYS, HOMESTEADERS, [card(INN), card(WOLVES)]).apply(s)
            expect(s.denizensAt('c1')).toEqual([TENTS, SCOUTS, INN])
        }
    })

    it('control: a Citizen is no enemy of the Chancellor who holds it, so nothing is locked for them', () => {
        const s = table({ revision: FIXED, atC1, bloodline: true, citizen: true })
        expect(isLockedFor(s, DANA, WOLVES)).toBe(false)
        expect(offeredFirst(s)).toEqual(atC1)
        actionPowerUse(DANA, HOMESTEADERS, [card(INN), card(WOLVES)]).apply(s)
        expect(s.denizensAt('c1')).toEqual([TENTS, SCOUTS, INN])
    })
})

describe('Roving Terror at the Great Slum, which shares the discard-first list (unchanged)', () => {
    // Dana at c2 with Roving Terror, which is itself at c2, a Great Slum; c1 is a Great Slum too.
    function roving(revision: OathRevision): HydratedOathGameState {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: DANA,
                    color: Color.Red,
                    siteId: 'c2',
                    favor: 3,
                    secrets: 2
                }),
                testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'p1', favor: 3 })
            ]),
            {
                oathRevision: revision,
                denizensBySite: {
                    c1: [MARRIAGE, WOLVES, TENTS],
                    c2: [ROVING, SCOUTS],
                    p1: [],
                    h1: []
                },
                siteCards: {
                    c1: 'site.great-slums',
                    c2: 'site.great-slums',
                    p1: 'site.marshes',
                    h1: 'site.mountain'
                }
            }
        )
        openTurn(s, DANA)
        return s
    }
    const rovingFirst = (s: HydratedOathGameState) => {
        const power = cardPower(ROVING, powerIndexOf(ROVING, PowerTiming.Action))
        if (!power) throw Error(`${ROVING} prints no Action power`)
        return offeredChoices(s, DANA, power)[1].options.flatMap((option) =>
            option.kind === PowerChoiceKind.Card ? [option.cardId] : []
        )
    }

    it('it never offers Marriage or itself to discard first, at revision 31 or 30', () => {
        for (const revision of [FIXED, BEFORE]) {
            expect(rovingFirst(roving(revision))).toEqual([WOLVES, TENTS, SCOUTS])
        }
    })
})

describe("on Dana's own view", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    it('the same offers and answers, with the state neither copied nor changed', () => {
        for (const [s, named, refused] of [
            [table({ revision: FIXED, atC1: [MARRIAGE, WOLVES, TENTS] }), MARRIAGE, true],
            [table({ revision: BEFORE, atC1: [MARRIAGE, WOLVES, TENTS] }), MARRIAGE, false],
            [table({ revision: FIXED, atC1: [SALT], salted: true }), SALT, true],
            [
                table({ revision: FIXED, atC1: [WOLVES, TENTS, SCOUTS], bloodline: true }),
                WOLVES,
                true
            ],
            [table({ revision: FIXED, atC1: [MARRIAGE, WOLVES, TENTS] }), WOLVES, false]
        ] as const) {
            s.getPlayerState(RHYS).handIds = [SCOUTS]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = ownView(s)
            const choices = [card(INN), card(named)]
            expect(offeredFirst(view)).toEqual(offeredFirst(s))
            expect(offeredFirst(view).includes(named)).toBe(!refused)
            expect(reasonFor(view, choices)).toBe(reasonFor(s, choices))
            expect(reasonFor(view, choices) !== undefined).toBe(refused)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})
