import { describe, expect, it } from 'vitest'
import { LocalSelections } from '@tabletop/frontend-components'
import { stagedChoices, type StagedChoices1862 } from './stagedChoices.js'

function table(choices: StagedChoices1862) {
    const selections = new LocalSelections()
    for (const selection of stagedChoices(choices)) selections.register(selection)
    return selections
}

describe('1862 staged choices', () => {
    it('takes back a small station’s line before the hex it stands in', () => {
        const choices: StagedChoices1862 = {
            charterBid: 0,
            smallStationLocation: 'B11',
            smallStationLine: '5,0'
        }
        const selections = table(choices)
        expect(selections.undo()).toBe(true)
        expect(choices).toMatchObject({ smallStationLocation: 'B11', smallStationLine: undefined })
        expect(selections.undo()).toBe(true)
        expect(choices.smallStationLocation).toBeUndefined()
        expect(selections.hasManual()).toBe(false)
        expect(selections.undo()).toBe(false)
    })

    it('drops a charter’s bid with the company it is for', () => {
        const choices: StagedChoices1862 = { selectedCharterCompany: 'ESR', charterBid: 15 }
        expect(table(choices).undo()).toBe(true)
        expect(choices).toMatchObject({ selectedCharterCompany: undefined, charterBid: 0 })
    })

    it('leaves Undo to the last Action when nothing is staged', () => {
        expect(table({ charterBid: 0 }).undo()).toBe(false)
    })

    it('clears every choice when a new state arrives', () => {
        const choices: StagedChoices1862 = {
            charterBid: 0,
            raiseAmount: 20,
            charterPar: 82,
            mergerPartner: 'ENR',
            smallStationLocation: 'E10',
            smallStationLine: '0,3'
        }
        table(choices).clear()
        expect(choices).toEqual({
            charterBid: 0,
            raiseAmount: undefined,
            charterPar: undefined,
            mergerPartner: undefined,
            smallStationLocation: undefined,
            smallStationLine: undefined
        })
    })
})
