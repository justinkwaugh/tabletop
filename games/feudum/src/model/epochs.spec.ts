import { describe, expect, it } from 'vitest'
import { isRollProgressDie } from '../actions/rollProgressDie.js'
import type { Epoch } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { playOutCards, showOnStacks, typesOf, type StackShowing } from '../testing/roundEnd.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
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

/** R-4.11.2 What the round's roll triggered. */
function triggeredBy(table: Table) {
    const roll = playOutCards(table).find((action) => isRollProgressDie(action))
    return roll?.metadata?.epochTriggered
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

    it('R-4.11-H1 at this step the roll names the epoch; the dawn moves the marker', () => {
        const table = tableShowing(1, [2, 2, 2, 2, 1, 1])

        const roll = playOutCards(table).find((action) => isRollProgressDie(action))

        expect(roll).toMatchObject({ metadata: { epochTriggered: 2 } })
        expect(table.state.flow.epochTriggered).toBeUndefined()
        expect(table.state.epoch).toBe(2)
    })

    it('R-4.11.2 the check sees the tile the die just removed', () => {
        const table = tableShowing(1, [2, 2, 2, 1, 3, 3])
        const roll = playOutCards(table).find((action) => isRollProgressDie(action))

        expect(roll).toMatchObject({
            metadata: { removed: { region: 'desert' }, epochTriggered: 2 }
        })
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
        expect(triggeredBy(tableShowing(epoch, tops))).toBe(next)
    })

    it('R-4.11.2 one at a time: in epoch I, three epoch III tops and four II trigger only II', () => {
        expect(triggeredBy(tableShowing(1, [2, 2, 2, 2, 3, 3]))).toBe(2)
    })

    it('R-4.11.2 one at a time: a later condition alone triggers nothing', () => {
        expect(triggeredBy(tableShowing(1, [3, 3, 3, 1, 1, 1]))).toBeUndefined()
    })
})

describe('R-4.12 a triggered epoch goes to its dawn', () => {
    it('R-4.11.2, R-4.12 the dawn follows the roll, with nobody asked between', () => {
        const table = tableShowing(1, [2, 2, 2, 2, 1, 1])

        const types = typesOf(playOutCards(table))

        expect(types.at(types.indexOf(ActionType.RollProgressDie) + 1)).toBe(ActionType.BeginDawn)
    })
})
