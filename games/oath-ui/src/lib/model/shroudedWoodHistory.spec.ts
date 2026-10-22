import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, HydratedTravel, MachineState, PowerQuestionKind, Region } from '@tabletop/oath'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { shroudedWoodState } from '$lib/testing/shroudedWoodTable.js'
import { describeAction, rowActorOf, rowWarbandOwner } from './actionDescription.js'
import { gridRefusal, reasonActionUnavailable } from './actionAvailability.js'
import { actionName } from './actionCatalogue.js'

afterEach(() => {
    disposeSessions()
})

describe('R-11.7 — leaving a Shrouded Wood an enemy rules, as the traveller reads it', () => {
    it('the bar is the action, Travel, as for any other Travel', () => {
        expect(actionName(ActionType.Travel)).toBe('Travel')
    })

    it('with no site payable, the Travel tile says why', async () => {
        const session = await openSessionOn(tableOf(shroudedWoodState(1, { inCradle: true })))
        expect(session.validActionTypes).not.toContain(ActionType.Travel)
        expect(
            session.humanizeReason(
                reasonActionUnavailable(session.gameState, 'Dana', ActionType.Travel)
            )
        ).toBe(
            'Rhys would pick where you go, and you can pay for no site: the cheapest is 2 Supply, you have 1'
        )
    })

    it('the Narrow Pass and The Hidden Place are picks like any other: with 1 Supply the tile is lit, as the engine allows', async () => {
        const state = shroudedWoodState(1)
        state.siteCards = {
            ...state.siteCards,
            c1: 'site.narrow-pass',
            c2: 'site.the-hidden-place'
        }
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(state, 'Dana', {})).toBeUndefined()
        const session = await openSessionOn(tableOf(state))
        expect(session.validActionTypes).toContain(ActionType.Travel)
        expect(gridRefusal(session.gameState, 'Dana', ActionType.Travel)).toBeUndefined()
        session.chooseAction(ActionType.Travel)
        expect(session.woodRegions?.map((r) => [r.region, r.cost, r.siteIds])).toEqual([
            [Region.Cradle, 0, ['c1', 'c2']]
        ])
    })
})

describe('R-11.7 — the History of a Travel the ruler settles', () => {
    const SITES: Record<string, string> = {
        'slot.provinces.1': 'Great Slum',
        'slot.hinterland.0': 'Mountain',
        'slot.cradle.0': 'Drowned City',
        'slot.hinterland.1': 'The Hidden Place'
    }
    const names = {
        player: (playerId: string) => playerId,
        site: (slotId: string) => SITES[slotId] ?? slotId,
        seats: ['Dana', 'Rhys']
    }

    function row(
        fields: { type: ActionType; playerId?: string } & Record<string, unknown>
    ): GameAction {
        return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
    }

    const travel = (metadata: Record<string, unknown>) =>
        row({
            type: ActionType.Travel,
            playerId: 'Dana',
            modifiers: [],
            metadata: {
                fromSiteId: 'slot.provinces.0',
                destinationChooser: 'Rhys',
                supplyRemaining: 2,
                ...metadata
            }
        })

    function pick(
        siteId: string,
        supplySpent: number,
        extra: Record<string, unknown> = {}
    ): GameAction {
        return row({
            type: ActionType.AnswerQuestion,
            playerId: 'Rhys',
            answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId },
            metadata: {
                cardId: 'site.shrouded-wood',
                kind: PowerQuestionKind.ShroudedWoodDestination,
                summary: `sent Dana to ${siteId}, who paid ${supplySpent} Supply`,
                resumeMachineState: MachineState.ActPhase,
                last: true,
                woodPick: {
                    travelerPlayerId: 'Dana',
                    siteId,
                    supplySpent,
                    supplyRemaining: 0,
                    ...extra
                }
            }
        })
    }

    it('the Travel names no cost, and the pick is the traveller’s row, word for word', () => {
        expect(describeAction(travel({ paysAtPick: true, supplySpent: 0 }), names, 'Dana')).toBe(
            'set out from Shrouded Wood; Rhys picks where'
        )
        expect(describeAction(travel({ supplySpent: 2 }), names, 'Dana')).toBe(
            'left Shrouded Wood, spending 2 Supply; Rhys picks where'
        )

        const slum = pick('slot.provinces.1', 2)
        expect(rowActorOf(slum)).toBe('Dana')
        expect(describeAction(slum, names, 'Dana')).toBe(
            "traveled from Shrouded Wood to Great Slum (Rhys's pick), spending 2 Supply"
        )
        expect(describeAction(slum, names, 'Rhys')).toBe(
            'traveled from Shrouded Wood to Great Slum (your pick), spending 2 Supply'
        )
        expect(describeAction(pick('slot.hinterland.0', 3), names, 'Dana')).toBe(
            "traveled from Shrouded Wood to Mountain (Rhys's pick), spending 3 Supply"
        )
        expect(describeAction(pick('slot.cradle.0', 0), names, 'Dana')).toBe(
            "traveled from Shrouded Wood to Drowned City (Rhys's pick)"
        )
    })

    it('a site whose name prints its own article is not given another', () => {
        expect(describeAction(pick('slot.hinterland.1', 3), names, 'Dana')).toBe(
            "traveled from Shrouded Wood to The Hidden Place (Rhys's pick), spending 3 Supply"
        )
    })

    it('Tyrant’s kill is a clause of the pick’s row, in the colour of the warband killed', () => {
        const tyrant = pick('slot.provinces.1', 2, {
            notes: ['Tyrant killed a warband at slot.provinces.1'],
            warbandOwner: 'Rhys'
        })
        expect(describeAction(tyrant, names, 'Dana')).toBe(
            "traveled from Shrouded Wood to Great Slum (Rhys's pick), spending 2 Supply; killed 1 warband at Great Slum (Tyrant)"
        )
        const own = (playerId: string) => `${playerId}'s own`
        expect(rowWarbandOwner(tyrant, own)).toBe('Rhys')
        expect(rowWarbandOwner(pick('slot.provinces.1', 2), own)).toBe("Dana's own")
    })
})
