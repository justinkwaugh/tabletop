import { expect, it } from 'vitest'
import { TrainDepot } from './trainDepot.js'
const depot = new TrainDepot({
    id: 'test',
    trains: [
        {
            id: 'local',
            name: 'Local',
            price: 100,
            distance: { measure: 'revenue-centers', maximum: 2 }
        },
        {
            id: 'express',
            name: 'Express',
            price: 500,
            distance: { measure: 'revenue-centers', maximum: 'unlimited' }
        }
    ],
    supply: [
        { definitionId: 'local', count: 2 },
        { definitionId: 'express', count: 'unlimited' }
    ]
})
it('keeps finite identities through ownership and removal and advances the supply order', () => {
    const inventory = depot.createInventory()
    expect(depot.nextDefinitionId(inventory)).toBe('local')
    for (let i = 0; i < 2; i++) {
        const train = depot.nextTrain(inventory, 'local')!
        depot.purchase(inventory, train.id, train.definitionId, { kind: 'company', companyId: 'A' })
        expect(() =>
            depot.purchase(inventory, train.id, train.definitionId, {
                kind: 'company',
                companyId: 'B'
            })
        ).toThrow('no longer available')
    }
    expect(depot.remaining(inventory, 'local')).toBe(0)
    expect(depot.nextDefinitionId(inventory)).toBe('express')
    inventory.trains[0] = { id: inventory.trains[0].id, definitionId: 'local', status: 'removed' }
    depot.validateInventory(inventory, ['A'], [])
    expect(depot.nextDefinitionId(inventory)).toBe('express')
})
it('issues unlimited trains only on purchase and preserves deterministic identities through removal', () => {
    const inventory = depot.createInventory()
    const before = structuredClone(inventory)
    const offered = depot.nextTrain(inventory, 'express')!
    expect(depot.nextTrain(inventory, 'express')).toEqual(offered)
    expect(inventory).toEqual(before)
    depot.purchase(inventory, offered.id, 'express', { kind: 'company', companyId: 'A' })
    expect(depot.nextTrain(inventory, 'express')!.id).not.toBe(offered.id)
    expect(depot.remaining(inventory, 'express')).toBe('unlimited')
    depot.validateInventory(inventory, ['A'], [])
    const replay = structuredClone(before)
    depot.purchase(replay, offered.id, 'express', { kind: 'company', companyId: 'A' })
    expect(replay).toEqual(inventory)
    inventory.trains[inventory.trains.length - 1] = {
        id: offered.id,
        definitionId: 'express',
        status: 'removed'
    }
    depot.validateInventory(inventory, [], [])
    expect(depot.nextTrain(inventory, 'express')!.id).not.toBe(offered.id)
})
it('rejects corrupt supply, duplicate identities, unknown owners and reused issuance cursors', () => {
    const inventory = depot.createInventory()
    const missing = structuredClone(inventory)
    missing.trains.pop()
    expect(() => depot.validateInventory(missing, [], [])).toThrow('Missing finite')
    const duplicate = structuredClone(inventory)
    duplicate.trains.push(duplicate.trains[0])
    expect(() => depot.validateInventory(duplicate, [], [])).toThrow('Duplicate train')
    const offered = depot.nextTrain(inventory, 'express')!
    depot.purchase(inventory, offered.id, 'express', { kind: 'company', companyId: 'missing' })
    expect(() => depot.validateInventory(inventory, [], [])).toThrow('Unknown train owner')
    inventory.nextTrainNumber--
    expect(() => depot.validateInventory(inventory, ['missing'], [])).toThrow(
        'Invalid unlimited train'
    )
})
