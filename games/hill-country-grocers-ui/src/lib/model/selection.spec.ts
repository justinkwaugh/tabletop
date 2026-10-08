import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { CompanyId } from '@tabletop/hill-country-grocers'
import {
    AuctionStageOrder,
    BuildStageOrder,
    DevelopStageOrder,
    addBuildHex,
    addPayee,
    hasManualSelection,
    popAuctionSelection,
    popBuildSelection,
    popDevelopSelection,
    selectAuctionCompany,
    selectBuildCompany,
    selectDevelopCity,
    selectedHexes,
    selectedPayees
} from './selection.js'

const first = { q: 1, r: 2 }
const second = { q: 2, r: 2 }

describe('Hill Country Grocers staged selections', () => {
    it.each([
        ['build', BuildStageOrder],
        ['develop', DevelopStageOrder],
        ['auction', AuctionStageOrder]
    ])('throws for a stage outside the %s stage order', (_, order) => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                order,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('fills store stages in order and clears them when the grocer changes', () => {
        let selection = selectBuildCompany({}, CompanyId.AlamoCity)
        selection = addBuildHex(addBuildHex(selection, first), second)
        expect(selectedHexes(selection)).toEqual([first, second])

        selection = selectBuildCompany(selection, CompanyId.Verbena)
        expect(selection.company?.value).toBe(CompanyId.Verbena)
        expect(selectedHexes(selection)).toEqual([])
    })

    it('pops the latest store, then the grocer', () => {
        let selection = addBuildHex(selectBuildCompany({}, CompanyId.AlamoCity), first)
        selection = popBuildSelection(selection)
        expect(selectedHexes(selection)).toEqual([])
        expect(selection.company?.value).toBe(CompanyId.AlamoCity)

        selection = popBuildSelection(selection)
        expect(selection).toEqual({})
    })

    it('clears the payees when another city is chosen', () => {
        let selection = addPayee(selectDevelopCity({}, 'san-antonio'), CompanyId.AlamoCity)
        expect(selectedPayees(selection)).toEqual([CompanyId.AlamoCity])

        selection = selectDevelopCity(selection, 'austin')
        expect(selection.city?.value).toBe('austin')
        expect(selectedPayees(selection)).toEqual([])
    })

    it('pops the latest payee, then the city', () => {
        let selection = addPayee(selectDevelopCity({}, 'san-antonio'), CompanyId.AlamoCity)
        selection = popDevelopSelection(selection)
        expect(selectedPayees(selection)).toEqual([])
        expect(selection.city?.value).toBe('san-antonio')

        expect(popDevelopSelection(selection)).toEqual({})
    })

    it('replaces the auction company and pops it', () => {
        let selection = selectAuctionCompany({}, CompanyId.Verbena)
        selection = selectAuctionCompany(selection, CompanyId.AlamoCity)
        expect(selection.company?.value).toBe(CompanyId.AlamoCity)
        expect(popAuctionSelection(selection)).toEqual({})
    })

    it('reports a manual choice in any of the three flows', () => {
        expect(hasManualSelection({}, {}, {})).toBe(false)
        expect(hasManualSelection(selectBuildCompany({}, CompanyId.Verbena), {}, {})).toBe(true)
        expect(hasManualSelection({}, selectDevelopCity({}, 'austin'), {})).toBe(true)
        expect(hasManualSelection({}, {}, selectAuctionCompany({}, CompanyId.Balcones))).toBe(true)
    })
})
