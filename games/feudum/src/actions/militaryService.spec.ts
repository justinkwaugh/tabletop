import { assertExists, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { disloyaltyVp } from '../model/activeRegions.js'
import { placeMarker } from '../model/locationControl.js'
import type { TriggeredEpoch } from '../model/flow.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from '../stateHandlers/cardTurns.js'
import { playToDawn } from '../testing/dawn.js'
import { setPawns } from '../testing/guilds.js'
import { setUp, spaceOfKind } from '../testing/improving.js'
import { answerStarve, giveFood, starve, tableAtStarve } from '../testing/starve.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { isBeginDawn } from './beginDawn.js'
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

describe('R-4.9.2, R-4.9-H2, D16 disloyalty at a dawn', () => {
    /** R-4.8 A seat ruling a feudum is a vassal; this one holds no rank to score. */
    function ruleFeudum(state: HydratedFeudumGameState, playerId: string) {
        setPawns(state, playerId, [])
        state.recomputeRanks()
        const spaceId = spaceOfKind(state, 'farm')
        state.spaces[spaceId].location.kind = 'feudum'
        placeMarker(state, playerId, spaceId)
    }

    function rowsOf(processed: readonly GameAction[]) {
        const dawn = processed.find((action) => isBeginDawn(action))
        assertExists(dawn?.metadata, 'R-4.12 The dawn ran')
        return dawn.metadata.sheet
    }

    const Dawns: { epoch: TriggeredEpoch; covered: number; vp: number }[] = [
        { epoch: 2, covered: 0, vp: -3 },
        { epoch: 2, covered: 1, vp: 0 },
        { epoch: 3, covered: 0, vp: 0 },
        { epoch: 4, covered: 0, vp: -7 },
        { epoch: 4, covered: 1, vp: -4 },
        { epoch: 4, covered: 2, vp: 0 },
        { epoch: 5, covered: 0, vp: -12 },
        { epoch: 5, covered: 2, vp: -5 },
        { epoch: 5, covered: 3, vp: 0 }
    ]

    it.each(Dawns)(
        'R-4.9.2 at dawn $epoch a vassal with $covered covered loses $vp',
        ({ epoch, covered, vp }) => {
            const { table, processed, order } = playToDawn(epoch, (state, [vassal]) => {
                ruleFeudum(state, vassal)
                state.militaryService[vassal] = covered
            })

            const [row] = rowsOf(processed).filter((entry) => entry.playerId === order[0])
            expect(row.disloyaltyVp).toBe(vp)
            expect(row.total).toBe(row.activeRegions.vp + vp)
            expect(table.seat(order[0]).score).toBe(row.total)
        }
    )

    it('R-4.9.2 a seat ruling no feudum loses nothing, its spaces uncovered', () => {
        const { processed } = playToDawn(5)

        expect(rowsOf(processed).map((row) => row.disloyaltyVp)).toEqual([0, 0, 0])
    })

    it("R-4.9-H2 another seat's discs cover nothing for the vassal", () => {
        const { processed, order } = playToDawn(2, (state, [vassal, other]) => {
            ruleFeudum(state, vassal)
            state.militaryService[other] = 3
        })

        const [vassal, other] = order
        const rows = rowsOf(processed)
        expect(rows.find((row) => row.playerId === vassal)?.disloyaltyVp).toBe(-3)
        expect(rows.find((row) => row.playerId === other)?.disloyaltyVp).toBe(0)
    })
})
