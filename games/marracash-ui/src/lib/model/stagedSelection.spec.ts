import { describe, expect, it } from 'vitest'
import { QueueEnd } from '@tabletop/marracash'
import {
    hasManualMarracashSelection,
    popMarracashSelection,
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
})
