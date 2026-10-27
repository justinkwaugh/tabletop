import { describe, expect, it } from 'vitest'
import { Resource } from '@tabletop/power-grid'
import {
    hasManualPowerGridSelection,
    popPowerGridSelection,
    setPowerGridSelection,
    type PowerGridSelection
} from './stagedSelection.js'

describe('Power Grid staged selection', () => {
    it('clears the bid when another plant is chosen', () => {
        let selection: PowerGridSelection = {}
        selection = setPowerGridSelection(selection, 'plant', 7)
        selection = setPowerGridSelection(selection, 'bid', 12)
        selection = setPowerGridSelection(selection, 'plant', 9)
        expect(selection.plant?.value).toBe(9)
        expect(selection.bid).toBeUndefined()
    })

    it('pops the bid, then the plant, before reporting nothing to pop', () => {
        let selection: PowerGridSelection = {}
        selection = setPowerGridSelection(selection, 'plant', 7)
        selection = setPowerGridSelection(selection, 'bid', 12)
        selection = popPowerGridSelection(selection)
        expect(selection.bid).toBeUndefined()
        expect(selection.plant?.value).toBe(7)
        selection = popPowerGridSelection(selection)
        expect(hasManualPowerGridSelection(selection)).toBe(false)
    })

    it('takes back one cart token or city at a time', () => {
        let selection: PowerGridSelection = {}
        selection = setPowerGridSelection(selection, 'cart', [Resource.Coal, Resource.Oil])
        selection = popPowerGridSelection(selection)
        expect(selection.cart?.value).toEqual([Resource.Coal])
        selection = popPowerGridSelection(selection)
        expect(selection.cart).toBeUndefined()

        selection = setPowerGridSelection(selection, 'cities', ['essen', 'duisburg'])
        selection = popPowerGridSelection(selection)
        expect(selection.cities?.value).toEqual(['essen'])
    })

    it('clears a stage set to nothing', () => {
        const selection = setPowerGridSelection({}, 'scrap', 4)
        expect(setPowerGridSelection(selection, 'scrap', undefined)).toEqual({})
    })
})
