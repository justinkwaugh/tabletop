import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, MachineState, PowerQuestionKind } from '@tabletop/oath'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { describeAction, rowActorOf, rowWarbandOwner } from './actionDescription.js'
import { reasonActionUnavailable } from './actionAvailability.js'
import { actionName } from './actionCatalogue.js'

afterEach(() => {
    disposeSessions()
})

describe('R-11.7 — leaving a Shrouded Wood an enemy rules, as the traveller reads it', () => {
    it('the bar is the action, Travel, as for any other Travel', () => {
        expect(actionName(ActionType.Travel)).toBe('Travel')
    })

    it('with no site payable, the Travel tile says why', () => {
        const session = openSessionOn(tableOf(shroudedWoodState(1, { inCradle: true })))
        expect(session.validActionTypes).not.toContain(ActionType.Travel)
        expect(session.humanizeReason(reasonActionUnavailable(session.gameState, 'Jacob', ActionType.Travel))).toBe('Cole would pick where you go, and you can pay for no site: the cheapest is 2 Supply, you have 1')
    })
})

describe('R-11.7 — the History of a Travel the ruler settles', () => {
    const SITES: Record<string, string> = { 'slot.provinces.1': 'Great Slum', 'slot.hinterland.0': 'Mountain', 'slot.cradle.0': 'Drowned City' }
    const names = { player: (playerId: string) => playerId, site: (slotId: string) => SITES[slotId] ?? slotId, seats: ['Jacob', 'Cole'] }

    function row(fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
        return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
    }

    const travel = (metadata: Record<string, unknown>) => row({ type: ActionType.Travel, playerId: 'Jacob', modifiers: [], metadata: { fromSiteId: 'slot.provinces.0', destinationChooser: 'Cole', supplyRemaining: 2, ...metadata } })

    function pick(siteId: string, supplySpent: number, extra: Record<string, unknown> = {}): GameAction {
        return row({
            type: ActionType.AnswerQuestion,
            playerId: 'Cole',
            answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId },
            metadata: {
                cardId: 'site.shrouded-wood',
                kind: PowerQuestionKind.ShroudedWoodDestination,
                summary: `sent Jacob to ${siteId}, who paid ${supplySpent} Supply`,
                resumeMachineState: MachineState.ActPhase,
                last: true,
                woodPick: { travelerPlayerId: 'Jacob', siteId, supplySpent, supplyRemaining: 0, ...extra }
            }
        })
    }

    it('the Travel names no cost, and the pick is the traveller’s row, word for word', () => {
        expect(describeAction(travel({ paysAtPick: true, supplySpent: 0 }), names, 'Jacob')).toBe('set out from the Shrouded Wood; Cole picks where')
        expect(describeAction(travel({ supplySpent: 2 }), names, 'Jacob')).toBe('left the Shrouded Wood, spending 2 Supply — Cole chooses where')

        const slum = pick('slot.provinces.1', 2)
        expect(rowActorOf(slum)).toBe('Jacob')
        expect(describeAction(slum, names, 'Jacob')).toBe("left the Shrouded Wood for the Great Slum (Cole's pick), paying 2 Supply")
        expect(describeAction(slum, names, 'Cole')).toBe('left the Shrouded Wood for the Great Slum (your pick), paying 2 Supply')
        expect(describeAction(pick('slot.hinterland.0', 3), names, 'Jacob')).toBe("left the Shrouded Wood for the Mountain (Cole's pick), paying 3 Supply")
        expect(describeAction(pick('slot.cradle.0', 0), names, 'Jacob')).toBe("left the Shrouded Wood for the Drowned City (Cole's pick), paying no Supply")
    })

    it('Tyrant’s kill is a clause of the pick’s row, in the colour of the warband killed', () => {
        const tyrant = pick('slot.provinces.1', 2, { notes: ['Tyrant killed a warband at slot.provinces.1'], warbandOwner: 'Cole' })
        expect(describeAction(tyrant, names, 'Jacob')).toBe("left the Shrouded Wood for the Great Slum (Cole's pick), paying 2 Supply; Tyrant killed a warband at the Great Slum")
        const own = (playerId: string) => `${playerId}'s own`
        expect(rowWarbandOwner(tyrant, own)).toBe('Cole')
        expect(rowWarbandOwner(pick('slot.provinces.1', 2), own)).toBe("Jacob's own")
    })
})
