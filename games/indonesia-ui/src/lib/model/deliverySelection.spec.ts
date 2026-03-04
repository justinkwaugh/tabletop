import { describe, expect, it } from 'vitest'
import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    hasManualDeliverySelection,
    popHighestManualDeliverySelection,
    setDeliveryCitySelection,
    setDeliveryCultivatedSelection,
    type DeliverySelectionValueByStage
} from './deliverySelection.js'

describe('deliverySelection', () => {
    it('does not treat auto cultivated selection as a manual mid-action', () => {
        let state: StagedSelectionState<DeliverySelectionValueByStage> = {}
        state = setDeliveryCultivatedSelection(state, 'A01', 'auto')

        expect(hasManualDeliverySelection(state)).toBe(false)
    })

    it('treats manual cultivated selection as manual mid-action', () => {
        let state: StagedSelectionState<DeliverySelectionValueByStage> = {}
        state = setDeliveryCultivatedSelection(state, 'A01', 'manual')

        expect(hasManualDeliverySelection(state)).toBe(true)
    })

    it('pops city first and keeps cultivated selection', () => {
        let state: StagedSelectionState<DeliverySelectionValueByStage> = {}
        state = setDeliveryCultivatedSelection(state, 'A01', 'auto')
        state = setDeliveryCitySelection(state, 'city-1')

        const popped = popHighestManualDeliverySelection(state)

        expect(popped.poppedStage).toBe('city')
        expect(popped.nextState.cultivated?.value).toBe('A01')
        expect(popped.nextState.city).toBeUndefined()
        expect(hasManualDeliverySelection(popped.nextState)).toBe(false)
    })

    it('reselecting cultivated clears city selection', () => {
        let state: StagedSelectionState<DeliverySelectionValueByStage> = {}
        state = setDeliveryCultivatedSelection(state, 'A01', 'manual')
        state = setDeliveryCitySelection(state, 'city-1')

        const nextState = setDeliveryCultivatedSelection(state, 'A02', 'manual')

        expect(nextState.cultivated?.value).toBe('A02')
        expect(nextState.city).toBeUndefined()
    })
})
