import { describe, expect, it } from 'vitest'
import { AlgaColor, CoralColor } from '@tabletop/reef-encounter'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import {
    hasManualReefSelection,
    popReefSelection,
    ReefStageOrder,
    setReefSelection,
    type ReefSelectionValues
} from './stagedSelection.js'

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

    it('clears every later stage when a stage is set', () => {
        const paying = setReefSelection(
            setReefSelection({}, 'cylinderPayment', CoralColor.White),
            'cylinderAlga',
            AlgaColor.Blue
        )
        const shrimp = setReefSelection(paying, 'shrimp', { kind: 'introduce' })
        expect(shrimp.shrimp?.value).toEqual({ kind: 'introduce' })
        expect(shrimp.cylinderPayment).toBeUndefined()
        expect(shrimp.cylinderAlga).toBeUndefined()

        const source = setReefSelection(shrimp, 'polypSource', 'consumed')
        expect(source.shrimp).toBeUndefined()
    })

    it('reselecting the cylinder payment drops the colour chosen after it', () => {
        const chosen = setReefSelection(
            setReefSelection({}, 'cylinderPayment', CoralColor.White),
            'cylinderAlga',
            AlgaColor.Red
        )
        const repaid = setReefSelection(chosen, 'cylinderPayment', CoralColor.Grey)
        expect(repaid.cylinderPayment?.value).toBe(CoralColor.Grey)
        expect(repaid.cylinderAlga).toBeUndefined()
    })

    it('pops one manual stage per Undo, highest first', () => {
        const chosen = setReefSelection(
            setReefSelection({}, 'cylinderPayment', CoralColor.White),
            'cylinderAlga',
            AlgaColor.Green
        )
        const once = popReefSelection(chosen)
        expect(once.cylinderAlga).toBeUndefined()
        expect(once.cylinderPayment?.value).toBe(CoralColor.White)
        const twice = popReefSelection(once)
        expect(hasManualReefSelection(twice)).toBe(false)
    })

    it('leaves nothing for Undo to pop once only auto selections remain', () => {
        const auto = setStagedSelectionValue<ReefSelectionValues, 'polypSource'>(
            {},
            ReefStageOrder,
            'polypSource',
            'screen',
            'auto'
        )
        expect(hasManualReefSelection(auto)).toBe(false)
    })

    it('throws on a stage that is not in the order', () => {
        expect(() =>
            setReefSelection({}, 'unknown' as keyof ReefSelectionValues, CoralColor.Pink as never)
        ).toThrow()
    })
})
