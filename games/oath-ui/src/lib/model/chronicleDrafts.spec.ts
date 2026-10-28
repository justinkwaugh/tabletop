import { afterEach, describe, expect, it } from 'vitest'
import {
    ActionType,
    CHRONICLE_STORY_LIMIT,
    ChronicleStep,
    HydratedOathGameState,
    OathType,
    Suit,
    chronicleSuitLeaders,
    citizenshipEligible,
    edificeChoices,
    vowableOaths
} from '@tabletop/oath'
import { served } from '@tabletop/oath/testing'
import { addedBySuit, storyDraft, storyWritable } from './chronicleDrafts.js'
import {
    ALCHEMIST,
    ANN,
    DANA,
    FAE_MERCHANT,
    GREAT_SPIRE,
    HERALD,
    LONGBOWS,
    RHYS,
    gameOneAt,
    gameTwoAt
} from '$lib/testing/chronicleTables.js'
import { disposeSessions, openSessionOn, type PlayedTable } from '$lib/testing/sessionHarness.js'

afterEach(() => disposeSessions())

/** The chooser's own view: what their client is served. */
function chooserView(table: PlayedTable, playerId: string): HydratedOathGameState {
    return new HydratedOathGameState(served(table.state, { kind: 'player', playerId }))
}

const full = (table: PlayedTable) => new HydratedOathGameState(table.state)

describe('each step’s offer, on the chooser’s served view and on the full state alike', () => {
    it('the Vow: every Oath but this game’s, in the Law’s order; Supremacy is never shown', async () => {
        const table = gameOneAt('vow')
        expect(vowableOaths(chooserView(table, DANA))).toEqual(vowableOaths(full(table)))
        const session = await openSessionOn(table)
        expect(session.gameState.chronicle?.step).toBe(ChronicleStep.Vow)
        expect(session.oathPick.oaths).toEqual([
            OathType.ThePeople,
            OathType.Protection,
            OathType.Devotion
        ])
        expect(session.oathPick.picked).toBeUndefined()
        session.oathPick.pick(OathType.Supremacy)
        expect(session.oathPick.picked).toBeUndefined()
        session.oathPick.pick(OathType.Protection)
        expect(session.oathPick.picked).toBe(OathType.Protection)
    })

    it('the offer: every other Exile; never the winner or the Chancellor; chips toggle', async () => {
        const table = gameOneAt('offer')
        expect(citizenshipEligible(chooserView(table, DANA))).toEqual([ANN])
        expect(citizenshipEligible(full(table))).toEqual([ANN])
        const session = await openSessionOn(table)
        const offer = session.chronicleOffer
        expect(offer.eligible).toEqual([ANN])
        expect(offer.eligible).not.toContain(DANA)
        expect(offer.eligible).not.toContain(RHYS)
        offer.toggle(ANN)
        expect(offer.picked).toEqual([ANN])
        offer.toggle(ANN)
        expect(offer.picked).toEqual([])
    })

    it('the answer: only the offered Exile is asked; the winner offers nothing more', async () => {
        const session = await openSessionOn(gameOneAt('answer'))
        expect(session.myPlayer?.id).toBe(ANN)
        expect(session.validActionTypes).toEqual([ActionType.AnswerChronicleCitizenship])
        expect(session.chronicleOffer.eligible).toEqual([])
    })

    it('the build: a denizen at each ruled site whose suit’s edifice is in the Archive, ringed', async () => {
        const table = gameTwoAt('build')
        expect(edificeChoices(chooserView(table, ANN))).toEqual(edificeChoices(full(table)))
        const session = await openSessionOn(table)
        const build = session.chronicleBuild
        expect(build.ringed).toEqual([LONGBOWS, HERALD, FAE_MERCHANT, ALCHEMIST])
        expect(session.selectableCards).toEqual(build.ringed)
        expect(build.repairOffered).toBe(false)
        expect(build.pointed).toBeUndefined()
        build.point(LONGBOWS)
        expect(build.pointed).toMatchObject({
            cardId: LONGBOWS,
            edificeId: 'edifice.order.sprawling-rampart',
            repair: false
        })
        expect(session.mapPick).toMatchObject({ kind: 'build', choosing: true })
    })

    it('a ruin the winner rules is ringed for repair; its site’s denizens are not', async () => {
        const session = await openSessionOn(gameTwoAt('ruin'))
        const build = session.chronicleBuild
        expect(build.ringed).toContain(GREAT_SPIRE)
        expect(build.ringed).not.toContain(ALCHEMIST)
        expect(build.repairOffered).toBe(true)
        build.point(GREAT_SPIRE)
        expect(build.pointed).toMatchObject({ edificeId: GREAT_SPIRE, repair: true })
    })

    it('the suit: only the tied suits, in the clockwise order; each adds 3, 2 and 1', async () => {
        const table = gameTwoAt('suit')
        expect(chronicleSuitLeaders(chooserView(table, ANN))).toEqual(
            chronicleSuitLeaders(full(table))
        )
        const session = await openSessionOn(table)
        expect(session.chronicleSuit.suits).toEqual([Suit.Order, Suit.Hearth])
        expect(addedBySuit(Suit.Order)).toEqual([
            { suit: Suit.Order, count: 3 },
            { suit: Suit.Hearth, count: 2 },
            { suit: Suit.Beast, count: 1 }
        ])
        expect(addedBySuit(Suit.Nomad)).toEqual([
            { suit: Suit.Nomad, count: 3 },
            { suit: Suit.Discord, count: 2 },
            { suit: Suit.Arcane, count: 1 }
        ])
    })

    it('the heal: the tied stacks, each taking what it holds when that is under six', async () => {
        const table = gameTwoAt('heal')
        expect(chooserView(table, ANN).chronicle?.healTie).toEqual(full(table).chronicle?.healTie)
        const session = await openSessionOn(table)
        expect(session.healStack.suits).toEqual([Suit.Order, Suit.Beast])
        expect(session.healStack.count).toBe(5)
    })

    it('a seat the step does not wait on is offered nothing: Ann, answering, sees no Vow, offer or rings', async () => {
        const session = await openSessionOn(gameOneAt('answer'))
        expect(session.oathPick.oaths).toEqual([])
        expect(session.chronicleOffer.eligible).toEqual([])
        expect(session.chronicleBuild.ringed).toEqual([])
        expect(session.chronicleSuit.suits).toEqual([])
        expect(session.healStack.suits).toEqual([])
        expect(session.mapPick).toBeUndefined()
    })
})

describe('the story', () => {
    it('is capped at 1,000 code points, not UTF-16 units: an astral character counts once', () => {
        expect(CHRONICLE_STORY_LIMIT).toBe(1000)
        const astral = '🜂'.repeat(1000)
        expect(astral.length).toBe(2000)
        expect(storyDraft(astral)).toEqual({ text: astral, left: 0, countShown: true })
        expect(storyDraft(`${astral}a`).text).toBe(astral)
    })

    it('shows the count only in the last hundred: 930 characters leave "70 left"', () => {
        expect(storyDraft('a'.repeat(899)).countShown).toBe(false)
        expect(storyDraft('a'.repeat(930))).toMatchObject({ left: 70, countShown: true })
    })

    it('"Write" appears once there is text', () => {
        expect(storyWritable('')).toBe(false)
        expect(storyWritable('  \n ')).toBe(false)
        expect(storyWritable('The title stayed.')).toBe(true)
    })

    it('the result is unset until the story step is answered', () => {
        expect(gameOneAt('story').state.result).toBeUndefined()
        expect(gameOneAt('result').state.result).toBeDefined()
    })
})
