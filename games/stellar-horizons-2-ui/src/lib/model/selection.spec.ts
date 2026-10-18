import { describe, expect, it } from 'vitest'
import { AnomalyChallenge } from '@tabletop/stellar-horizons-2'
import {
    SelectionKind,
    eventSelection,
    popSelection,
    rewardSelection,
    selectedRewardDraft,
    shipSelection,
    toggleEventShip
} from './selection.js'

describe('the event draft', () => {
    it('adds and takes out ships, and starts afresh for another challenge', () => {
        const science = toggleEventShip(undefined, 'unrest', AnomalyChallenge.Science, 'a')
        expect(science).toEqual({
            eventId: 'unrest',
            challenge: AnomalyChallenge.Science,
            shipIds: ['a']
        })
        expect(toggleEventShip(science, 'unrest', AnomalyChallenge.Combat, 'b')?.shipIds).toEqual([
            'b'
        ])
        expect(toggleEventShip(science, 'unrest', AnomalyChallenge.Science, 'a')).toBeUndefined()
    })
})

describe('Undo over a selection', () => {
    it('takes back one reward settlement at a time, then the whole placement', () => {
        const two = rewardSelection({ systemIds: ['barnards-star', 'alpha-centauri'] })
        const one = popSelection(two)
        expect(selectedRewardDraft(one)).toEqual({ systemIds: ['barnards-star'] })
        expect(popSelection(one)).toBeUndefined()
    })

    it('clears any other choice whole', () => {
        expect(popSelection(shipSelection('a'))).toBeUndefined()
        expect(
            popSelection(
                eventSelection({
                    eventId: 'unrest',
                    challenge: AnomalyChallenge.Combat,
                    shipIds: []
                })
            )
        ).toBeUndefined()
        expect(rewardSelection({ systemIds: [] })).toBeUndefined()
        expect(rewardSelection({ systemIds: ['a'] })?.kind).toBe(SelectionKind.RewardSettlements)
    })
})
