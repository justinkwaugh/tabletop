import { describe, expect, it } from 'vitest'
import { AlgaColor, CoralColor } from '@tabletop/reef-encounter'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import {
    chooseCylinderAlga,
    chooseCylinderPayment,
    chooseFirstLarvaCube,
    choosePlacementSquare,
    chooseShrimp,
    hasManualReefSelection,
    popReefSelection,
    ReefStageOrder,
    type ReefSelectionValues
} from './stagedSelection.js'

const square = { boardId: 3, coords: { row: 2, col: 2 } } as const

describe('Reef Encounter staged selection', () => {
    it('records a chosen first larva cube as a manual stage', () => {
        const selection = chooseFirstLarvaCube({}, CoralColor.Pink)
        expect(selection.firstLarvaCube).toEqual({ value: CoralColor.Pink, source: 'manual' })
        expect(hasManualReefSelection(selection)).toBe(true)
    })

    it('replaces the first cube when another is chosen first', () => {
        const grey = chooseFirstLarvaCube(
            chooseFirstLarvaCube({}, CoralColor.Pink),
            CoralColor.Grey
        )
        expect(grey.firstLarvaCube?.value).toBe(CoralColor.Grey)
    })

    it('clears every later stage when a stage is set', () => {
        const paying = chooseCylinderAlga(
            chooseCylinderPayment({}, CoralColor.White),
            AlgaColor.Blue
        )
        const shrimp = chooseShrimp(paying, { kind: 'introduce' })
        expect(shrimp.shrimp?.value).toEqual({ kind: 'introduce' })
        expect(shrimp.cylinderPayment).toBeUndefined()
        expect(shrimp.cylinderAlga).toBeUndefined()

        const placing = choosePlacementSquare(shrimp, square)
        expect(placing.placementSquare?.value).toEqual(square)
        expect(placing.shrimp).toBeUndefined()
    })

    it('reselecting the cylinder payment drops the colour chosen after it', () => {
        const chosen = chooseCylinderAlga(
            chooseCylinderPayment({}, CoralColor.White),
            AlgaColor.Red
        )
        const repaid = chooseCylinderPayment(chosen, CoralColor.Grey)
        expect(repaid.cylinderPayment?.value).toBe(CoralColor.Grey)
        expect(repaid.cylinderAlga).toBeUndefined()
    })

    it('pops one manual stage per Undo, highest first', () => {
        const chosen = chooseCylinderAlga(
            chooseCylinderPayment({}, CoralColor.White),
            AlgaColor.Green
        )
        const once = popReefSelection(chosen)
        expect(once.cylinderAlga).toBeUndefined()
        expect(once.cylinderPayment?.value).toBe(CoralColor.White)
        const twice = popReefSelection(once)
        expect(hasManualReefSelection(twice)).toBe(false)
    })

    it('leaves nothing for Undo to pop once only auto selections remain', () => {
        const auto = setStagedSelectionValue<ReefSelectionValues, 'placementSquare'>(
            {},
            ReefStageOrder,
            'placementSquare',
            square,
            'auto'
        )
        expect(hasManualReefSelection(auto)).toBe(false)
    })

    it('throws on a stage missing from the order', () => {
        expect(() =>
            setStagedSelectionValue<ReefSelectionValues, 'eating'>(
                {},
                ['firstLarvaCube'],
                'eating',
                true,
                'manual'
            )
        ).toThrow()
    })
})
