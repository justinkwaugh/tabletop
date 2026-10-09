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
    const leftPlay = structuredClone(inventory)
    leftPlay.trains.pop()
    expect(() => depot.validateInventory(leftPlay, [], [])).not.toThrow()
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

it('keeps Market returns separate from new supply, including unlimited train identities', () => {
    const inventory = depot.createInventory()
    const train = depot.nextTrain(inventory, 'express')!
    depot.purchase(inventory, train.id, 'express', { kind: 'company', companyId: 'A' })
    const cursor = inventory.nextTrainNumber
    inventory.trains = inventory.trains.map((entry) =>
        entry.id === train.id
            ? { id: entry.id, definitionId: entry.definitionId, status: 'market', hasRun: true }
            : entry
    )
    depot.purchase(inventory, train.id, 'express', { kind: 'company', companyId: 'B' })
    expect(inventory.nextTrainNumber).toBe(cursor)
    expect(inventory.trains.find((entry) => entry.id === train.id)).toMatchObject({
        status: 'owned',
        hasRun: true,
        owner: { kind: 'company', companyId: 'B' }
    })
    expect(depot.nextTrain(inventory, 'express')!.id).not.toBe(train.id)
    depot.validateInventory(inventory, ['A', 'B'], [])
})

function variantDepot() {
    return new TrainDepot({
        id: 'variants',
        trains: [
            {
                id: '4',
                name: '4',
                price: 180,
                distance: { measure: 'revenue-centers', maximum: 4 }
            },
            {
                id: '3/5',
                name: '3/5',
                price: 160,
                distance: { measure: 'revenue-centers', maximum: 5 }
            }
        ],
        supply: [{ definitionId: '4', variantDefinitionIds: ['3/5'], count: 2 }]
    })
}
it('offers alternative definitions of the same finite physical train without duplicating supply', () => {
    const depot = variantDepot()
    const inventory = depot.createInventory()
    const four = depot.nextTrain(inventory, '4')!
    const express = depot.nextTrain(inventory, '3/5')!
    expect(express.id).toBe(four.id)
    expect(express.definitionId).toBe('3/5')
    expect(inventory.trains).toHaveLength(2)
    expect(depot.purchaseDefinitionIds()).toEqual(['4', '3/5'])
    depot.purchase(inventory, express.id, '3/5', { kind: 'company', companyId: 'A' })
    expect(inventory.trains[0]).toMatchObject({ id: four.id, definitionId: '3/5', status: 'owned' })
    expect(depot.remaining(inventory, '4')).toBe(1)
    expect(depot.remaining(inventory, '3/5')).toBe(1)
    expect(() =>
        depot.purchase(inventory, four.id, '4', { kind: 'company', companyId: 'A' })
    ).toThrow()
    depot.validateInventory(inventory, ['A'], [])
    const next = depot.nextTrain(inventory, '4')!
    depot.purchase(inventory, next.id, '4', { kind: 'company', companyId: 'A' })
    expect(depot.nextTrain(inventory, '3/5')).toBeUndefined()
    expect(depot.remaining(inventory, '4')).toBe(0)
})
it('retains the physical supply identity for unlimited alternative definitions', () => {
    const definition = structuredClone(variantDepot().definition)
    definition.supply[0].count = 'unlimited'
    const depot = new TrainDepot(definition)
    const inventory = depot.createInventory()
    const first = depot.nextTrain(inventory, '3/5')!
    expect(first.id).toBe(depot.nextTrain(inventory, '4')?.id)
    depot.purchase(inventory, first.id, '3/5', { kind: 'company', companyId: 'A' })
    depot.validateInventory(inventory, ['A'], [])
    expect(depot.nextTrain(inventory, '4')?.id).not.toBe(first.id)
})
it('rejects overlapping variant supplies and definitions not supplied on a certificate', () => {
    const definition = structuredClone(variantDepot().definition)
    definition.supply.push({ definitionId: '3/5', count: 1 })
    expect(() => new TrainDepot(definition)).toThrow('one supply')
    const depot = variantDepot()
    const inventory = depot.createInventory()
    inventory.trains[0].definitionId = 'missing'
    expect(() => depot.validateInventory(inventory, [], [])).toThrow()
})

it('selects finite or unlimited supply by inventory identity without changing train definitions', () => {
    const varied = new TrainDepot({
        ...depot.definition,
        supplyVariants: { short: { local: 1, express: 2 } }
    })
    const standard = varied.createInventory()
    const short = varied.createInventory('short')
    expect(varied.remaining(standard, 'express')).toBe('unlimited')
    expect(varied.remaining(short, 'local')).toBe(1)
    expect(varied.remaining(short, 'express')).toBe(2)
    for (const definitionId of ['local', 'express', 'express']) {
        const offered = varied.nextTrain(short, definitionId)!
        varied.purchase(short, offered.id, definitionId, { kind: 'company', companyId: 'A' })
    }
    expect(varied.nextDefinitionId(short)).toBeUndefined()
    expect(varied.nextTrain(short, 'express')).toBeUndefined()
    expect(varied.remaining(standard, 'express')).toBe('unlimited')
    varied.validateInventory(short, ['A'], [])
    varied.validateInventory(standard, [], [])
    const returned = short.trains.at(-1)!
    short.trains[short.trains.length - 1] = {
        id: returned.id,
        definitionId: returned.definitionId,
        status: 'market'
    }
    expect(varied.remaining(short, 'express')).toBe(0)
    varied.purchase(short, returned.id, 'express', { kind: 'company', companyId: 'B' })
    varied.validateInventory(short, ['A', 'B'], [])
    expect(() => varied.createInventory('unknown')).toThrow('Unknown train supply variant')
    expect(
        () => new TrainDepot({ ...depot.definition, supplyVariants: { short: { missing: 1 } } })
    ).toThrow('Unknown supply variant entry')
})
