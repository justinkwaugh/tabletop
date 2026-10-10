import { describe, expect, it } from 'vitest'
import { CoralColor } from '@tabletop/reef-encounter'
import { hasManualReefSelection, popReefSelection, setReefSelection } from './stagedSelection.js'

describe('Reef Encounter staged selection', () => {
    it('records a chosen first larva cube as a manual stage', () => {
        const selection = setReefSelection({}, 'firstLarvaCube', CoralColor.Pink)
        expect(selection.firstLarvaCube).toEqual({ value: CoralColor.Pink, source: 'manual' })
        expect(hasManualReefSelection(selection)).toBe(true)
    })

    it('replaces the first cube when another is chosen first', () => {
        const pink = setReefSelection({}, 'firstLarvaCube', CoralColor.Pink)
        const grey = setReefSelection(pink, 'firstLarvaCube', CoralColor.Grey)
        expect(grey.firstLarvaCube?.value).toBe(CoralColor.Grey)
    })

    it('pops the first cube on Undo, leaving nothing staged', () => {
        const selection = popReefSelection(setReefSelection({}, 'firstLarvaCube', CoralColor.White))
        expect(selection.firstLarvaCube).toBeUndefined()
        expect(hasManualReefSelection(selection)).toBe(false)
    })
})
