import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, CardKind, HydratedMuster, HydratedSearch, HydratedTravel, MachineState, PowerTiming, cardIdsOfKind, legalChoices, powersWithTiming } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { allowsSeveral } from './powerChoices.js'
import { ACTION_CARD_CONSEQUENCES, actionCards, actionMenuRows, answerCostText, cardCostLine, cardsMakingPossible, printedPowerWords, soleDeclarations, type ActionCard } from './actionCards.js'

const MUSHROOMS = 'denizen.beast.mushrooms'
const TENTS = 'denizen.nomad.tents'
const SPECIAL_ENVOY = 'denizen.nomad.special-envoy'
const ERRAND_BOY = 'denizen.beast.errand-boy'
const INITIATION_RITE = 'denizen.arcane.initiation-rite'
const PRESSGANGS = 'denizen.order.pressgangs'
const HOSPITALITY = 'denizen.nomad.hospitality'
const HUNTING_PARTY = 'denizen.order.hunting-party'
const WAYSIDE_INN = 'denizen.hearth.wayside-inn'

type Seat = Parameters<typeof testPlayer>[0]
type Table = Parameters<typeof testState>[1]

function table(me: Partial<Seat>, state: Table = {}) {
    const s = testState(
        [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 0, secrets: 0, supply: 0, ...me })],
        {
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            discardPileCounts: { cradle: 2, provinces: 3, hinterland: 0 },
            ...state
        }
    )
    openTurn(s, 'me')
    return s
}

const advisers = (...cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))
const listed = (s: ReturnType<typeof table>) => actionCards(s, 'me').map((card) => [card.cardId, card.action, card.kind])

describe('R-7.4 — the cards that change an action, as the powers list them', () => {
    it('Mushrooms makes a Search possible at 1 Supply, where a Search paid with Supply is refused', () => {
        const s = table({ supply: 1, secrets: 1 }, { denizensBySite: { c1: [MUSHROOMS] } })
        expect(HydratedSearch.canDoSearch(s, 'me')).toBe(false)
        expect(listed(s)).toEqual([[MUSHROOMS, ActionType.Search, 'makesPossible']])
    })

    it('Mushrooms changes a Search that is already possible', () => {
        const s = table({ supply: 2, secrets: 1 }, { denizensBySite: { c1: [MUSHROOMS] } })
        expect(HydratedSearch.canDoSearch(s, 'me')).toBe(true)
        expect(listed(s)).toEqual([[MUSHROOMS, ActionType.Search, 'changes']])
    })

    it('lists no card whose cost cannot be paid', () => {
        const s = table({ supply: 1, secrets: 0 }, { denizensBySite: { c1: [MUSHROOMS] } })
        expect(listed(s)).toEqual([])
    })

    it('lists each card that makes a Travel possible at 0 Supply, with what it brings', () => {
        const s = table({ supply: 0, favor: 2, advisers: advisers(TENTS, SPECIAL_ENVOY) })
        expect(HydratedTravel.canDoTravel(s, 'me')).toBe(false)
        expect(actionCards(s, 'me')).toEqual([
            expect.objectContaining({ cardId: TENTS, action: ActionType.Travel, kind: 'makesPossible' }),
            expect.objectContaining({ cardId: SPECIAL_ENVOY, action: ActionType.Travel, kind: 'makesPossible', consequence: 'ends your Act Phase' })
        ])
        expect(actionCards(s, 'me')[0].consequence).toBeUndefined()
    })

    it('Errand Boy makes a Search possible when the pawn’s pile is empty and the world deck is out of reach', () => {
        const s = table(
            { supply: 2, favor: 1, advisers: advisers(ERRAND_BOY) },
            { discardPileCounts: { cradle: 0, provinces: 3, hinterland: 0 }, visionsDrawn: 1 }
        )
        expect(listed(s)).toEqual([[ERRAND_BOY, ActionType.Search, 'makesPossible']])
    })

    it('Pressgangs makes a Muster possible on a card that already holds a token', () => {
        const s = table(
            { supply: 1, favor: 1, advisers: advisers(PRESSGANGS) },
            { denizensBySite: { c1: [WAYSIDE_INN] }, cardTokens: { [WAYSIDE_INN]: { favor: 1, secrets: 0 } } }
        )
        expect(HydratedMuster.canDoMuster(s, 'me')).toBe(false)
        expect(listed(s)).toEqual([[PRESSGANGS, ActionType.Muster, 'makesPossible']])
    })

    it('leaves out a card the engine applies by itself (Initiation Rite, R-7.4.1)', () => {
        const s = table({ supply: 1, secrets: 2, advisers: advisers(INITIATION_RITE) }, { denizensBySite: { c1: [WAYSIDE_INN] } })
        expect(HydratedMuster.canDoMuster(s, 'me')).toBe(true)
        expect(listed(s)).toEqual([])
    })

    it('leaves out a card that only adds something after the action, though its condition narrows the menu', () => {
        const hospitality = table({ supply: 3, advisers: advisers(HOSPITALITY) }, { denizensBySite: { c1: [WAYSIDE_INN], c2: [TENTS] } })
        const [power] = powersWithTiming(HOSPITALITY, PowerTiming.Modifier)
        const withIt = actionMenuRows(hospitality, 'me', ActionType.Travel, soleDeclarations(hospitality, 'me', power).slice(0, 1))
        expect(withIt.length).toBeLessThan(actionMenuRows(hospitality, 'me', ActionType.Travel, []).length)
        expect(listed(hospitality)).toEqual([])

        const huntingParty = table({ supply: 3, advisers: advisers(HUNTING_PARTY) })
        expect(actionMenuRows(huntingParty, 'me', ActionType.Search, []).length).toBe(2)
        expect(listed(huntingParty)).toEqual([])
    })

    it('R-10.2 — lists nothing while a free action is due, when only it is offered', () => {
        const due = { supply: 1, secrets: 1, favor: 1, advisers: advisers(TENTS) }
        const cards = { denizensBySite: { c1: [MUSHROOMS] } }
        expect(listed(table(due, cards)).length).toBeGreaterThan(0)
        expect(listed(table({ ...due, freeTravelAtAction: 0 }, cards))).toEqual([])
    })

    it('lists nothing outside the Act Phase', () => {
        const s = table({ supply: 1, secrets: 1 }, { denizensBySite: { c1: [MUSHROOMS] }, machineState: MachineState.RestPhase })
        expect(actionCards(s, 'me')).toEqual([])
    })
})

describe('R-7.4 — a card declared alone, at each choice its text opens', () => {
    it('is one declaration for a card with no choice, and one per region for a card that names a pile', () => {
        const s = table({ supply: 2, secrets: 1, favor: 1, advisers: advisers(ERRAND_BOY) }, { denizensBySite: { c1: [MUSHROOMS] } })
        const [mushrooms] = powersWithTiming(MUSHROOMS, PowerTiming.Modifier)
        const [errandBoy] = powersWithTiming(ERRAND_BOY, PowerTiming.Modifier)
        expect(soleDeclarations(s, 'me', mushrooms)).toEqual([{ cardId: MUSHROOMS, powerIndex: mushrooms.powerIndex }])
        expect(soleDeclarations(s, 'me', errandBoy).map((use) => use.choices)).toHaveLength(2)
    })
})

describe('R-7.4 — the choices a modifier card opens', () => {
    it('never take several picks, which a card declared alone is not tried with', () => {
        const s = table({ supply: 7, favor: 5, secrets: 5 })
        const cards = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)]
        const several = cards.flatMap((cardId) =>
            powersWithTiming(cardId, PowerTiming.Modifier).filter((power) => legalChoices(s, 'me', power).some(allowsSeveral)).map(() => cardId)
        )
        expect(several).toEqual([])
    })
})

describe('what a card brings, said before it is used', () => {
    it('is kept only for cards that print a modifier', () => {
        const cards = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)]
        for (const cardId of Object.keys(ACTION_CARD_CONSEQUENCES)) {
            expect(cards).toContain(cardId)
            expect(powersWithTiming(cardId, PowerTiming.Modifier)).toHaveLength(1)
        }
    })
})

describe('the words of a card’s row and of the grey tile', () => {
    const card = (cardId: string, action: ActionCard['action'], kind: ActionCard['kind']): ActionCard => ({ cardId, powerIndex: 0, action, kind })

    it('finds every card that makes the tapped action possible, and none that only changes it', () => {
        const cards = [
            card(TENTS, ActionType.Travel, 'makesPossible'),
            card(SPECIAL_ENVOY, ActionType.Travel, 'makesPossible'),
            card(MUSHROOMS, ActionType.Search, 'changes')
        ]
        expect(cardsMakingPossible(cards, ActionType.Travel)).toEqual(cards.slice(0, 2))
        expect(cardsMakingPossible(cards, ActionType.Search)).toEqual([])
        expect(cardsMakingPossible(cards, ActionType.Muster)).toEqual([])
    })

    it('says what using the card costs, or that it is free (R-7.1.2)', () => {
        const none = { placeFavor: 0, burnFavor: 0, placeSecret: 0, burnSecret: 0 }
        expect(cardCostLine(none)).toBe('free')
        expect(cardCostLine({ ...none, placeSecret: 1 })).toBe('put 1 secret on it')
        expect(cardCostLine({ ...none, placeFavor: 2, burnSecret: 2 })).toBe('put 2 favor on it, burn 2 secrets')
    })

    it('a question’s yes shows what the card costs as counts, nothing when free', () => {
        const none = { placeFavor: 0, burnFavor: 0, placeSecret: 0, burnSecret: 0 }
        expect(answerCostText(none)).toBeUndefined()
        expect(answerCostText({ ...none, placeSecret: 1 })).toBe('1 secret')
        expect(answerCostText({ ...none, placeFavor: 1, placeSecret: 1 })).toBe('1 favor + 1 secret')
        expect(answerCostText({ ...none, burnFavor: 1, placeFavor: 1, burnSecret: 2 })).toBe('2 favor + 2 secrets')
    })

    it('turns the printed marks into words the tokens are drawn from', () => {
        expect(printedPowerWords('Spend no Supply, but draw only one card _(not three)_ from the bottom.')).toBe('Spend no Supply, but draw only one card (not three) from the bottom.')
        expect(printedPowerWords('To muster, you **must** place [secret] instead of [favor].')).toBe('To muster, you must place secret instead of favor.')
        expect(printedPowerWords('Gain [favor][favor] if mustering on a [suit:beast] card.')).toBe('Gain 2 favor if mustering on a beast card.')
    })
})
