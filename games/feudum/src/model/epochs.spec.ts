import { describe, expect, it } from 'vitest'
import { isRollProgressDie } from '../actions/rollProgressDie.js'
import type { Epoch } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { playOutCards, showOnStacks, type StackShowing } from '../testing/roundEnd.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { legalStackRegions } from './regionStacks.js'

/** A round of one forfeit each, in this epoch, with these stack tops. */
function tableShowing(epoch: Epoch, tops: readonly StackShowing[]) {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
    table.moveTo((state) => {
        showOnStacks(state, tops)
        state.epoch = epoch
        return MachineState.PlayingCards
    })
    return table
}

describe('R-4.11-H1 the next epoch triggers only at this step', () => {
    it('R-4.11-H1 a condition met mid-round changes nothing until the die', () => {
        const table = tableShowing(1, [2, 2, 2, 2, 1, 1])
        const [first] = table.order

        table.send(first, { type: ActionType.ForfeitCard, kind: 'move' })

        expect(table.state.flow.epochTriggered).toBeUndefined()
        expect(table.state.epoch).toBe(1)
        expect(legalStackRegions(table.hydrated())).toEqual(['badlands', 'mountain'])
    })

    it('R-4.11-H1 at this step the flag is set; the marker is the dawn’s to move', () => {
        const table = tableShowing(1, [2, 2, 2, 2, 1, 1])

        const roll = playOutCards(table).find((action) => isRollProgressDie(action))

        expect(table.state.flow.epochTriggered).toBe(2)
        expect(table.state.epoch).toBe(1)
        expect(roll).toMatchObject({ metadata: { epochTriggered: 2 } })
    })

    it('R-4.11.2 the check sees the tile the die just removed', () => {
        const table = tableShowing(1, [2, 2, 2, 1, 3, 3])
        const roll = playOutCards(table).find((action) => isRollProgressDie(action))

        expect(roll).toMatchObject({ metadata: { removed: { region: 'desert' } } })
        expect(table.state.flow.epochTriggered).toBe(2)
    })

    it('R-4.11.2 with no epoch triggered the flag stays off and the round ends', () => {
        const table = tableShowing(1, [1, 1, 1, 1, 1, 1])

        const roll = playOutCards(table).find((action) => isRollProgressDie(action))

        expect(table.state.flow.epochTriggered).toBeUndefined()
        expect(roll?.metadata).not.toHaveProperty('epochTriggered')
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
    })
})

describe('R-4.11.2 by the stack-top counts', () => {
    it.each<{ epoch: Epoch; tops: readonly StackShowing[]; next: number | undefined }>([
        { epoch: 1, tops: [2, 2, 2, 2, 2, 2], next: 2 },
        { epoch: 2, tops: [3, 3, 3, 3, 3, 3], next: 3 },
        { epoch: 3, tops: [4, 4, 4, 4, 4, 4], next: 4 },
        { epoch: 4, tops: ['V', 4, 4, 4, 4, 4], next: 5 },
        { epoch: 2, tops: [2, 2, 2, 2, 2, 2], next: undefined }
    ])('in epoch $epoch, tops $tops: $next', ({ epoch, tops, next }) => {
        const table = tableShowing(epoch, tops)

        playOutCards(table)

        expect(table.state.flow.epochTriggered).toBe(next)
    })

    it('R-4.11.2 one at a time: in epoch I, three epoch III tops and four II trigger only II', () => {
        const table = tableShowing(1, [2, 2, 2, 2, 3, 3])

        playOutCards(table)

        expect(table.state.flow.epochTriggered).toBe(2)
    })

    it('R-4.11.2 one at a time: a later condition alone triggers nothing', () => {
        const table = tableShowing(1, [3, 3, 3, 1, 1, 1])

        playOutCards(table)

        expect(table.state.flow.epochTriggered).toBeUndefined()
    })
})

describe('R-4.12 a triggered epoch waits for its dawn', () => {
    it('R-4.11.2 the round stays at the roll with nobody asked', () => {
        const table = tableShowing(1, [2, 2, 2, 2, 1, 1])

        playOutCards(table)

        expect(table.state.machineState).toBe(MachineState.ProgressRoll)
        expect(table.state.activePlayerIds).toEqual([])
        for (const playerId of table.order) {
            expect(table.offered(playerId)).toEqual([])
        }
    })
})
