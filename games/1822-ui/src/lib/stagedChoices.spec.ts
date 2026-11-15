import { describe, expect, it } from 'vitest'
import type { MinorAcquisition1822 } from '@tabletop/1822'
import { LocalSelections } from '@tabletop/frontend-components'
import { StagedChoices1822, type PrivateOffer } from './stagedChoices.svelte.js'

function table() {
    const choices = new StagedChoices1822()
    const selections = new LocalSelections()
    for (const selection of choices.selections) selections.register(selection)
    return { choices, selections }
}

const minorOffer = (minorId: string, excessTrains = 0): MinorAcquisition1822 => ({
    companyId: 'CR',
    minorId,
    source: 'director',
    terms: [
        { shares: 1, payment: 10 },
        { shares: 2, payment: -40 }
    ],
    tokens: ['place', 'available'],
    excessTrains
})
const privateOffer: PrivateOffer = {
    privateCompanyId: 'P5',
    choices: ['channel', 'available'],
    needsDiscard: false
}

describe('1822 staged choices', () => {
    it('chooses a minor on the most shares and its first token choice, terms not the player’s', () => {
        const { choices, selections } = table()
        choices.chooseMinor(minorOffer('M2'))
        expect(choices.minorDraft()).toEqual({
            minorId: 'M2',
            shares: 2,
            token: 'place',
            discardTrainIds: []
        })
        // The defaults are not a step of their own: one Undo drops the whole choice.
        expect(selections.undo()).toBe(true)
        expect(choices.minorDraft()).toBeUndefined()
        expect(selections.undo()).toBe(false)
    })

    it('drops a minor’s changed terms with the choice, never undoing an Action', () => {
        const { choices, selections } = table()
        choices.chooseMinor(minorOffer('M2'))
        choices.changeMinorTerms({ shares: 1, token: 'available' })
        expect(choices.minorDraft()).toMatchObject({ shares: 1, token: 'available' })
        expect(selections.hasManual()).toBe(true)
        expect(selections.undo()).toBe(true)
        expect(choices.minorDraft()).toBeUndefined()
        expect(selections.undo()).toBe(false)
    })

    it('starts another minor’s terms afresh', () => {
        const { choices } = table()
        choices.chooseMinor(minorOffer('M2'))
        choices.changeMinorTerms({ shares: 1 })
        choices.chooseMinor(minorOffer('M5'))
        expect(choices.minorDraft()).toEqual({
            minorId: 'M5',
            shares: 2,
            token: 'place',
            discardTrainIds: []
        })
    })

    it('marks no more trains to discard than the acquisition must, and unmarks one', () => {
        const { choices } = table()
        choices.chooseMinor(minorOffer('M2', 1))
        choices.toggleMinorDiscard('t1', 1)
        expect(choices.minorDraft()?.discardTrainIds).toEqual(['t1'])
        choices.toggleMinorDiscard('t2', 1)
        expect(choices.minorDraft()?.discardTrainIds).toEqual(['t2'])
        choices.toggleMinorDiscard('t2', 1)
        expect(choices.minorDraft()?.discardTrainIds).toEqual([])
    })

    it('stages a private only where there is something to choose', () => {
        const { choices, selections } = table()
        expect(
            choices.choosePrivate(
                { privateCompanyId: 'P3', choices: [], needsDiscard: false },
                undefined
            )
        ).toBe(false)
        expect(choices.privateDraft()).toBeUndefined()
        expect(choices.choosePrivate(privateOffer, undefined)).toBe(true)
        expect(choices.privateDraft()).toEqual({ privateCompanyId: 'P5', choice: 'channel' })
        choices.changePrivateTerms({ choice: 'available' })
        expect(choices.privateDraft()?.choice).toBe('available')
        expect(selections.undo()).toBe(true)
        expect(choices.privateDraft()).toBeUndefined()
    })

    it('names the first train to discard for P1’s 5-train over the limit', () => {
        const { choices } = table()
        choices.choosePrivate(
            { privateCompanyId: 'P1', choices: [], needsDiscard: true },
            'train-1'
        )
        expect(choices.privateDraft()).toEqual({
            privateCompanyId: 'P1',
            discardTrainId: 'train-1'
        })
    })

    it('undoes P17’s chosen certificate before any Action, a changed pick and all', () => {
        const { choices, selections } = table()
        choices.stackCard.choose('choice', 'M7')
        choices.stackCard.choose('choice', 'M9')
        expect(choices.stackCard.value('choice')).toBe('M9')
        expect(selections.undo()).toBe(true)
        expect(choices.stackCard.value('choice')).toBeUndefined()
        expect(selections.undo()).toBe(false)
    })

    it('undoes the Metropolitan’s chosen London station before any Action', () => {
        const { choices, selections } = table()
        choices.metropolitanStation.choose('choice', 'n')
        choices.metropolitanStation.choose('choice', 'se')
        expect(choices.metropolitanStation.value('choice')).toBe('se')
        expect(selections.undo()).toBe(true)
        expect(choices.metropolitanStation.value('choice')).toBeUndefined()
        expect(selections.undo()).toBe(false)
    })

    it('clears every choice when a new state arrives', () => {
        const { choices, selections } = table()
        choices.chooseMinor(minorOffer('M2'))
        choices.choosePrivate(privateOffer, undefined)
        choices.stackCard.choose('choice', 'M7')
        choices.metropolitanStation.choose('choice', 'n')
        selections.clear()
        expect(choices.minorDraft()).toBeUndefined()
        expect(choices.privateDraft()).toBeUndefined()
        expect(choices.stackCard.value('choice')).toBeUndefined()
        expect(choices.metropolitanStation.value('choice')).toBeUndefined()
    })
})
