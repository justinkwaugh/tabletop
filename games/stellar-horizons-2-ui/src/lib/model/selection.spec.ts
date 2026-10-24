import { describe, expect, it } from 'vitest'
import { AnomalyChallenge, CombatKind } from '@tabletop/stellar-horizons-2'
import { GoodsHolderKind } from '@tabletop/stellar-horizons-2'
import {
    DISCARDED,
    SelectionKind,
    assignmentSelection,
    attackSelection,
    defenceSelection,
    selectedAttackDraft,
    selectedDefenceDraft,
    rewardGoodsSelection,
    selectedAssignmentDraft,
    selectedRewardGoodsDraft,
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

    it('takes back one drawn good, or one reward good, at a time', () => {
        const base = { kind: GoodsHolderKind.Base, systemId: 'alpha-centauri' } as const
        const earth = { kind: GoodsHolderKind.Earth } as const
        const assigned = assignmentSelection({ destinations: [base, DISCARDED, earth] })
        expect(selectedAssignmentDraft(popSelection(assigned))).toEqual({
            destinations: [base, DISCARDED]
        })
        expect(popSelection(assignmentSelection({ destinations: [earth] }))).toBeUndefined()
        const ship = { kind: GoodsHolderKind.Ship, shipId: 'starfarers-andromeda' } as const
        const placed = rewardGoodsSelection({ holders: [ship, ship] })
        expect(selectedRewardGoodsDraft(popSelection(placed))).toEqual({ holders: [ship] })
    })

    it('takes back an attack a ship at a time, then the RE, the kind of combat and the system', () => {
        const drafted = attackSelection({
            systemId: 'procyon',
            combatKind: CombatKind.Explorer,
            defenderId: 'p2',
            shipIds: ['praetorians-centurion'],
            explorerId: 'givers-linnaeus'
        })
        const noShip = popSelection(drafted)
        expect(selectedAttackDraft(noShip)).toMatchObject({
            combatKind: CombatKind.Explorer,
            shipIds: [],
            explorerId: 'givers-linnaeus'
        })
        const noExplorer = popSelection(noShip)
        expect(selectedAttackDraft(noExplorer)).toMatchObject({
            combatKind: CombatKind.Explorer,
            explorerId: undefined
        })
        const systemOnly = popSelection(noExplorer)
        expect(selectedAttackDraft(systemOnly)).toEqual({
            systemId: 'procyon',
            combatKind: undefined,
            defenderId: undefined,
            shipIds: [],
            explorerId: undefined
        })
        expect(popSelection(systemOnly)).toBeUndefined()
    })

    it('takes back one defending ship at a time', () => {
        const two = defenceSelection({ shipIds: ['consortium-guildmaster', 'consortium-sapphire'] })
        const one = popSelection(two)
        expect(selectedDefenceDraft(one)).toEqual({ shipIds: ['consortium-guildmaster'] })
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
