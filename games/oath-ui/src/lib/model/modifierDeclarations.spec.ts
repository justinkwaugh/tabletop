import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import { ActionType, MachineState, PowerChoiceKind, PowerTiming, Region, SearchSource, isSearch, powerIndexOf } from '@tabletop/oath'
import { openTurn, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { emptyPicks, withOptionPick } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const MUSHROOMS = 'denizen.beast.mushrooms'
const BRACKEN = 'denizen.beast.bracken'
const ERRAND_BOY = 'denizen.beast.errand-boy'
const OBSERVATORY = 'denizen.arcane.observatory'

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

function searching(advisers: string[]) {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                supply: 5,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            })
        ],
        {
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [OBSERVATORY], c2: [], p1: [], h1: [] },
            discardPileCounts: { cradle: 4, provinces: 3, hinterland: 2 }
        }
    )
    openTurn(state, 'me')
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Search)
    return { session, sent }
}

const piles = (session: OathGameSession) =>
    session.searchRows.filter((row) => row.source === SearchSource.Discard).map((row) => row.region)

function pickRegion(session: OathGameSession, cardId: string, region: Region) {
    const power = required(session.modifiers.options.find((p) => p.cardId === cardId), `${cardId} is usable`)
    const choice = required(session.modifiers.choicesOf(power)[0], `${cardId} asks for a region`)
    const pick = choice.options.findIndex((o) => o.kind === PowerChoiceKind.Region && o.region === region)
    session.modifiers.setPicks(use(cardId), withOptionPick(emptyPicks(), choice, 0, pick))
}

describe('R-7.4 — the piles a declared modifier lets a Search name', () => {
    it('lists the pawn’s pile once when the only region named is where the discards go (Bracken)', () => {
        const { session } = searching([BRACKEN])
        session.modifiers.declare(use(BRACKEN), true)
        expect(piles(session)).toEqual([Region.Cradle])
    })

    it('a Search from a pile Observatory names keeps the pile Bracken sends the discards to', async () => {
        const { session, sent } = searching([BRACKEN])
        session.modifiers.declare(use(BRACKEN), true)
        pickRegion(session, BRACKEN, Region.Hinterland)
        session.modifiers.declare(use(OBSERVATORY), true)
        expect(piles(session)).toEqual([Region.Cradle, Region.Provinces, Region.Hinterland])

        await session.searchFrom(required(session.searchRows.find((row) => row.region === Region.Provinces), 'the Provinces pile is listed'))
        const action = sent.mock.calls[0][0]
        assert(isSearch(action), 'a Search is sent')
        expect(action.modifiers).toEqual([
            { ...use(BRACKEN), choices: [{ kind: PowerChoiceKind.Region, region: Region.Hinterland }] },
            { ...use(OBSERVATORY), choices: [{ kind: PowerChoiceKind.Region, region: Region.Provinces }] }
        ])
    })

    it('one Search draws from one pile, so declaring a second modifier that names it puts the first down', () => {
        const { session } = searching([ERRAND_BOY])
        session.modifiers.declare(use(ERRAND_BOY), true)
        expect(piles(session)).toEqual([Region.Provinces, Region.Hinterland])

        session.modifiers.declare(use(OBSERVATORY), true)
        expect(session.modifiers.isDeclared(use(ERRAND_BOY))).toBe(false)
        expect(piles(session)).toEqual([Region.Cradle, Region.Provinces, Region.Hinterland])

        session.modifiers.declare(use(ERRAND_BOY), true)
        expect(session.modifiers.isDeclared(use(OBSERVATORY))).toBe(false)
        expect(piles(session)).toEqual([Region.Provinces, Region.Hinterland])
    })
})

describe('R-7.4 — an action opened from the powers with a card in use', () => {
    function withMushrooms(supply: number) {
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 0, secrets: 1, supply })],
            {
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [MUSHROOMS], c2: [], p1: [], h1: [] },
                discardPileCounts: { cradle: 2, provinces: 0, hinterland: 0 }
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        return { session, sent }
    }
    const rows = (session: OathGameSession) => session.searchRows.map((row) => [row.source, row.cost, row.draw])

    it('opens the Search with Mushrooms in use at 1 Supply, lists what it allows, and the row sends', async () => {
        const { session, sent } = withMushrooms(1)
        const [card] = session.actionCards
        expect(card).toMatchObject({ cardId: MUSHROOMS, action: ActionType.Search, kind: 'makesPossible' })

        session.openActionWithCard(card)
        expect(sent).not.toHaveBeenCalled()
        expect(session.selection.action).toBe(ActionType.Search)
        expect(session.modifiers.isDeclared(use(MUSHROOMS))).toBe(true)
        expect(rows(session)).toEqual([[SearchSource.Discard, 0, 1]])
        expect(session.searchRows[0].fromBottom).toBe(true)

        await session.searchFrom(session.searchRows[0])
        const action = sent.mock.calls[0][0]
        assert(isSearch(action), 'a Search is sent')
        expect(action.drawFrom).toBe(SearchSource.Discard)
        expect(action.modifiers).toEqual([use(MUSHROOMS)])
    })

    it('keeps the card in use while nothing else makes the menu possible, and Back returns to the powers', () => {
        const { session } = withMushrooms(1)
        session.openActionWithCard(session.actionCards[0])

        session.modifiers.declare(use(MUSHROOMS), false)
        expect(session.modifiers.isDeclared(use(MUSHROOMS))).toBe(true)

        session.back()
        expect(session.selection.action).toBe(ActionType.UseActionPower)
        expect(session.selection.modifiers).toEqual([])
        session.back()
        expect(session.selection.action).toBeUndefined()
    })

    it('lets the card be put down where the Search is possible without it', () => {
        const { session } = withMushrooms(2)
        expect(session.actionCards[0]).toMatchObject({ cardId: MUSHROOMS, kind: 'changes' })
        session.openActionWithCard(session.actionCards[0])
        expect(rows(session)).toEqual([[SearchSource.Discard, 0, 1]])

        session.modifiers.declare(use(MUSHROOMS), false)
        expect(session.modifiers.isDeclared(use(MUSHROOMS))).toBe(false)
        expect(rows(session)).toEqual([[SearchSource.WorldDeck, 2, 3], [SearchSource.Discard, 2, 3]])
    })

    it('keeps a card that names the pile in use when only a pile other than its first can be drawn from', () => {
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 1, secrets: 0, supply: 2, advisers: [{ cardId: ERRAND_BOY, faceUp: true }] })],
            {
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
                discardPileCounts: { cradle: 0, provinces: 0, hinterland: 2 },
                visionsDrawn: 1
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const [card] = session.actionCards
        expect(card).toMatchObject({ cardId: ERRAND_BOY, kind: 'makesPossible' })

        session.openActionWithCard(card)
        expect(piles(session)).toEqual([Region.Hinterland])
        session.modifiers.declare(use(ERRAND_BOY), false)
        expect(session.modifiers.isDeclared(use(ERRAND_BOY))).toBe(true)
        expect(piles(session)).toEqual([Region.Hinterland])
    })

    it('Back takes a card added in the menu first, then returns the opened one to the powers', () => {
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 0, secrets: 1, supply: 1, advisers: [{ cardId: BRACKEN, faceUp: true }] })],
            {
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [MUSHROOMS], c2: [], p1: [], h1: [] },
                discardPileCounts: { cradle: 2, provinces: 0, hinterland: 0 }
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        session.openActionWithCard(session.actionCards[0])
        session.modifiers.declare(use(BRACKEN), true)
        expect(session.selection.modifiers.map((m) => m.use.cardId)).toEqual([MUSHROOMS, BRACKEN])

        session.back()
        expect(session.selection.action).toBe(ActionType.Search)
        expect(session.selection.modifiers.map((m) => m.use.cardId)).toEqual([MUSHROOMS])
        session.back()
        expect(session.selection.action).toBe(ActionType.UseActionPower)
    })

    it('with two cards that each make the Travel possible, either may be put down but not both, and Back still returns to the powers', () => {
        const TENTS = 'denizen.nomad.tents'
        const SPECIAL_ENVOY = 'denizen.nomad.special-envoy'
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 2, supply: 0, advisers: [{ cardId: TENTS, faceUp: true }, { cardId: SPECIAL_ENVOY, faceUp: true }] })],
            { machineState: MachineState.ActPhase, denizensBySite: { c1: [], c2: [], p1: [], h1: [] } }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const tents = required(session.actionCards.find((card) => card.cardId === TENTS), 'Tents makes the Travel possible')
        session.openActionWithCard(tents)
        session.modifiers.declare(use(SPECIAL_ENVOY), true)

        session.modifiers.declare(use(TENTS), false)
        expect(session.selection.modifiers.map((m) => m.use.cardId)).toEqual([SPECIAL_ENVOY])
        session.modifiers.declare(use(SPECIAL_ENVOY), false)
        expect(session.selection.modifiers.map((m) => m.use.cardId)).toEqual([SPECIAL_ENVOY])

        session.back()
        expect(session.selection.action).toBe(ActionType.UseActionPower)
    })

    it('Back returns to the powers after the opened card gives way to another that names the pile', () => {
        const { session } = searching([ERRAND_BOY])
        session.back()
        const errandBoy = required(session.actionCards.find((card) => card.cardId === ERRAND_BOY), 'Errand Boy changes the Search')
        session.openActionWithCard(errandBoy)
        session.modifiers.declare(use(OBSERVATORY), true)
        expect(session.selection.modifiers.map((m) => m.use.cardId)).toEqual([OBSERVATORY])

        session.back()
        expect(session.selection.action).toBe(ActionType.UseActionPower)
    })
})
