import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { QueueEnd } from '@tabletop/marracash'
import {
    MarracashStageOrder,
    hasManualMarracashSelection,
    popMarracashSelection,
    setMarracashSelection,
    updateMarracashRefill,
    type MarracashSelection
} from './stagedSelection.js'

describe('MarraCash staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                MarracashStageOrder,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('clears later stages when an earlier stage is set', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'fountain', 3)
        selection = setMarracashSelection(selection, 'destination', 5)
        selection = setMarracashSelection(selection, 'fountain', 9)

        expect(selection.fountain?.value).toBe(9)
        expect(selection.destination).toBeUndefined()
    })

    it('builds one refill choice from an end and a count chosen in either order', () => {
        let selection: MarracashSelection = {}
        selection = updateMarracashRefill(selection, { count: 3 })
        selection = updateMarracashRefill(selection, { end: QueueEnd.Back })
        expect(selection.refill).toEqual({
            value: { end: QueueEnd.Back, count: 3 },
            source: 'manual'
        })

        selection = updateMarracashRefill(selection, { end: QueueEnd.Front })
        expect(selection.refill?.value).toEqual({ end: QueueEnd.Front, count: 3 })
    })

    it('lets a pawn replace the whole refill choice at once', () => {
        let selection: MarracashSelection = {}
        selection = updateMarracashRefill(selection, { count: 3 })
        selection = updateMarracashRefill(selection, { end: QueueEnd.Back, count: 2 })
        expect(selection.refill?.value).toEqual({ end: QueueEnd.Back, count: 2 })
    })

    it('clears the whole refill choice with one Back or Undo', () => {
        let selection: MarracashSelection = {}
        selection = updateMarracashRefill(selection, { end: QueueEnd.Front })
        selection = updateMarracashRefill(selection, { count: 4 })

        selection = popMarracashSelection(selection)
        expect(selection.refill).toBeUndefined()
        expect(hasManualMarracashSelection(selection)).toBe(false)
    })

    it('drops a chosen shop when a fountain is chosen instead', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'shop', 'R1')
        selection = setMarracashSelection(selection, 'fountain', 1)

        expect(selection.fountain?.value).toBe(1)
        expect(selection.shop).toBeUndefined()
    })

    it('has no manual choice to undo before the player picks anything', () => {
        expect(hasManualMarracashSelection({})).toBe(false)
        expect(popMarracashSelection({})).toEqual({})
    })

    it('clears a choice when its stage is set to nothing', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'fountain', 9)
        selection = setMarracashSelection(selection, 'fountain', undefined)

        expect(selection.fountain).toBeUndefined()
        expect(hasManualMarracashSelection(selection)).toBe(false)
    })

    it('clears a previewed destination when another fountain is chosen, and backs out of it first', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'fountain', 3)
        selection = setMarracashSelection(selection, 'destination', 5)

        selection = popMarracashSelection(selection)
        expect(selection.fountain?.value).toBe(3)
        expect(selection.destination).toBeUndefined()

        selection = setMarracashSelection(selection, 'destination', 1)
        selection = setMarracashSelection(selection, 'fountain', 9)
        expect(selection.fountain?.value).toBe(9)
        expect(selection.destination).toBeUndefined()
    })
})
