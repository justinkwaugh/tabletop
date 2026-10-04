import { describe, expect, it } from 'vitest'
import { QueueEnd } from '@tabletop/marracash'
import {
    hasManualMarracashSelection,
    popMarracashSelection,
    setMarracashQueueEnd,
    setMarracashRefill,
    setMarracashSelection,
    type MarracashSelection
} from './stagedSelection.js'

describe('MarraCash staged selection', () => {
    it('clears later stages when an earlier stage is set', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'queueEnd', QueueEnd.Front)
        selection = setMarracashSelection(selection, 'visitorCount', 3)
        selection = setMarracashSelection(selection, 'queueEnd', QueueEnd.Back)

        expect(selection.queueEnd?.value).toBe(QueueEnd.Back)
        expect(selection.visitorCount).toBeUndefined()
    })

    it('keeps the chosen visitor count when switching queue ends', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashQueueEnd(selection, QueueEnd.Front)
        selection = setMarracashSelection(selection, 'visitorCount', 3)
        selection = setMarracashQueueEnd(selection, QueueEnd.Back)

        expect(selection.queueEnd?.value).toBe(QueueEnd.Back)
        expect(selection.visitorCount?.value).toBe(3)

        selection = popMarracashSelection(selection)
        expect(selection.queueEnd?.value).toBe(QueueEnd.Back)
        expect(selection.visitorCount).toBeUndefined()
    })

    it('takes a queue end and count together from a pawn, after a count chosen first', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'visitorCount', 3)
        selection = setMarracashRefill(selection, QueueEnd.Back, 2)
        expect(selection.queueEnd).toEqual({ value: QueueEnd.Back, source: 'manual' })
        expect(selection.visitorCount).toEqual({ value: 2, source: 'manual' })
    })

    it('removes only the newest manual choice on Back or Undo', () => {
        let selection: MarracashSelection = {}
        selection = setMarracashSelection(selection, 'queueEnd', QueueEnd.Front)
        selection = setMarracashSelection(selection, 'visitorCount', 4)

        selection = popMarracashSelection(selection)
        expect(selection.queueEnd?.value).toBe(QueueEnd.Front)
        expect(selection.visitorCount).toBeUndefined()

        selection = popMarracashSelection(selection)
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
