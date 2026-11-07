import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { disloyaltyVp } from '../model/activeRegions.js'
import { queueFollowUp } from '../model/followUps.js'
import { stateAfterCardStep } from '../stateHandlers/cardTurns.js'
import { setUp } from '../testing/improving.js'
import { answerStarve, giveFood, starve, tableAtStarve } from '../testing/starve.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { placeDiscOffer } from './placeDisc.js'

/** The turn player's card has just left a military service offer. */
function offered(table: Table, covered = 0): string {
    const playerId = table.asked
    table.moveTo((state, context) => {
        state.militaryService[playerId] = covered
        queueFollowUp(state, { kind: 'military', playerId })
        return stateAfterCardStep(context)
    })
    return playerId
}

describe('R-4.9.1, R-4.9-H1, R-4.9-H2 placing a military service disc', () => {
    it('R-4.9.1 goes on the seat’s own next uncovered space, vassal or not; no barrier', () => {
        const table = tableAtPlayingCards()
        const playerId = offered(table)
        expect(table.hydrated().isVassal(playerId)).toBe(false)
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.asked).toBe(playerId)
        expect(placeDiscOffer(table.hydrated(), playerId)).toEqual({
            disc: 'military',
            space: 1,
            drawsWrits: false
        })

        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })

        const state = table.hydrated()
        expect(state.militaryService[playerId]).toBe(1)
        expect(state.freeDiscs(playerId)).toBe(2)
        expect(action).toMatchObject({ metadata: { disc: 'military', space: 1 } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.asked).toBe(table.order[1])
    })

    it('R-4.9-H1 is asked: declining keeps the disc and the space uncovered', () => {
        const table = tableAtPlayingCards()
        const playerId = offered(table)
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: false })
        expect(table.hydrated().militaryService[playerId]).toBe(0)
        expect(table.hydrated().freeDiscs(playerId)).toBe(3)
        expect(action).toMatchObject({ metadata: { disc: 'military' } })
        expect(table.asked).toBe(table.order[1])
    })

    it('R-4.9-H2 each seat covers the spaces itself: a disc there leaves another’s next at 1', () => {
        const table = tableAtPlayingCards()
        const first = offered(table)
        table.send(first, { type: ActionType.PlaceDisc, place: true })

        const second = offered(table)
        expect(second).not.toBe(first)
        expect(placeDiscOffer(table.hydrated(), second)).toMatchObject({ space: 1 })
        table.send(second, { type: ActionType.PlaceDisc, place: true })

        expect(table.hydrated().militaryService).toMatchObject({ [first]: 1, [second]: 1 })
    })

    it.each([1, 2])('R-4.9.1 with %i covered the next disc takes the next space', (covered) => {
        const table = tableAtPlayingCards()
        const playerId = offered(table, covered)
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(table.hydrated().militaryService[playerId]).toBe(covered + 1)
        expect(action).toMatchObject({ metadata: { space: covered + 1 } })
    })

    it('R-4.9.1 with every space covered no disc is offered', () => {
        const table = tableAtPlayingCards()
        const playerId = offered(table, 3)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
        expect(placeDiscOffer(table.hydrated(), playerId)).toBeUndefined()
    })

    it('R-1.1 with no free disc no disc is offered', () => {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            state.voyageTrack[playerId] = 1
            state.guilds.tracks.farmer.master = { playerId, reeve: true }
            state.militaryService[playerId] = 1
            queueFollowUp(state, { kind: 'military', playerId })
            return stateAfterCardStep(context)
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-4.9.2 what the disc covers disloyalty then counts', () => {
        const table = tableAtPlayingCards()
        const playerId = offered(table)
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        const state = table.hydrated()
        const feudum = 'space.desert.3'
        state.spaces[feudum].ruler = { playerId, subject: false }
        state.spaces[feudum].location.kind = 'feudum'
        // Space 1 covered: only space 2 is due by dawn IV, and space 3 not yet.
        expect(disloyaltyVp(state, playerId, 2)).toBe(0)
        expect(disloyaltyVp(state, playerId, 4)).toBe(-4)
    })
})

describe('R-4.9-H1 after a Starve the People', () => {
    it('R-4.9-H1 a successful Starve offers the disc to the actor', () => {
        const combat = tableAtStarve()
        starve(combat)
        expect(combat.table.state.flow.turn?.followUps).toEqual([
            { kind: 'military', playerId: combat.attackerId }
        ])
        expect(combat.table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.9-H1 a Starve let stand offers it too, once answered', () => {
        const combat = tableAtStarve()
        setUp(combat.table, (state) => giveFood(state, combat.defenderId))
        starve(combat)
        expect(combat.table.state.flow.turn?.followUps).toEqual([])
        answerStarve(combat)
        expect(combat.table.asked).toBe(combat.attackerId)
        expect(combat.table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.9-H1 a Starve cancelled by Royal Immunity offers nothing', () => {
        const combat = tableAtStarve()
        setUp(combat.table, (state) => giveFood(state, combat.defenderId))
        starve(combat)
        answerStarve(combat, true)
        expect(combat.table.state.machineState).toBe(MachineState.PlayingCards)
        expect(combat.table.state.flow.turn?.followUps).toEqual([])
    })
})
