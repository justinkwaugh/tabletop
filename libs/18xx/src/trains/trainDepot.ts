import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Clone } from 'typebox/value'
import { assert, assertExists, deepFreeze } from '@tabletop/common'
import { TrainDefinition, releaseTrains, type Train, type TrainInventory } from './train.js'
import type { Owner } from '../finance/finance.js'
const SupplyCount = Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('unlimited')])
const SupplyEntry = Type.Object(
    {
        definitionId: Type.String({ minLength: 1 }),
        variantDefinitionIds: Type.Optional(
            Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true })
        ),
        count: SupplyCount
    },
    { additionalProperties: false }
)
const AssignedTrain = Type.Object(
    { id: Type.String({ minLength: 1 }), definitionId: Type.String({ minLength: 1 }) },
    { additionalProperties: false }
)
export const TrainDepotDefinition = Type.Object(
    {
        id: Type.String({ minLength: 1 }),
        trains: Type.Array(TrainDefinition),
        supply: Type.Array(SupplyEntry),
        supplyVariants: Type.Optional(
            Type.Record(
                Type.String({ minLength: 1 }),
                Type.Record(Type.String({ minLength: 1 }), SupplyCount)
            )
        ),
        assignedTrains: Type.Optional(Type.Array(AssignedTrain))
    },
    { additionalProperties: false }
)
export type TrainDepotDefinition = Type.Static<typeof TrainDepotDefinition>
const Validator = Compile(TrainDepotDefinition)
export class TrainDepot {
    readonly definition: TrainDepotDefinition
    constructor(definition: TrainDepotDefinition) {
        assert(Validator.Check(definition), 'Invalid train depot definition')
        assert(
            new Set(definition.trains.map((train) => train.id)).size === definition.trains.length,
            'Duplicate train definition'
        )
        assert(
            new Set(definition.supply.map((entry) => entry.definitionId)).size ===
                definition.supply.length,
            'Duplicate train supply entry'
        )
        const supplied = definition.supply.flatMap((entry) => [
            entry.definitionId,
            ...(entry.variantDefinitionIds ?? [])
        ])
        assert(
            new Set(supplied).size === supplied.length,
            'A train definition belongs to one supply'
        )
        assert(
            supplied.every((id) => definition.trains.some((train) => train.id === id)),
            'Unknown train supply definition'
        )
        for (const [id, counts] of Object.entries(definition.supplyVariants ?? {})) {
            assert(id !== definition.id, 'A supply variant requires a distinct depot identity')
            assert(
                Object.keys(counts).every((id) =>
                    definition.supply.some((entry) => entry.definitionId === id)
                ),
                'Unknown supply variant entry'
            )
        }
        const assigned = definition.assignedTrains ?? []
        assert(
            new Set(assigned.map((train) => train.id)).size === assigned.length,
            'Duplicate assigned train'
        )
        assert(
            assigned.every((train) =>
                definition.trains.some((entry) => entry.id === train.definitionId)
            ),
            'Unknown assigned train definition'
        )
        this.definition = Clone(definition)
        deepFreeze(this.definition)
    }
    trainDefinition(id: string): TrainDefinition {
        const definition = this.definition.trains.find((train) => train.id === id)
        assertExists(definition, 'Unknown train definition')
        return definition
    }
    purchaseDefinitionIds(): string[] {
        return this.definition.supply.flatMap((entry) => [
            entry.definitionId,
            ...(entry.variantDefinitionIds ?? [])
        ])
    }
    certificateDefinitions(definitionId: string): string[] {
        const entry = this.supplyEntry(definitionId)
        assertExists(entry, 'Train has no supply entry')
        return [entry.definitionId, ...(entry.variantDefinitionIds ?? [])]
    }
    private supplyEntries(depotId: string) {
        if (depotId === this.definition.id) return this.definition.supply
        const counts = this.definition.supplyVariants?.[depotId]
        assertExists(counts, 'Unknown train supply variant')
        return this.definition.supply.map((entry) => ({
            ...entry,
            count: counts[entry.definitionId] ?? entry.count
        }))
    }
    private supplyEntry(definitionId: string, depotId = this.definition.id) {
        return this.supplyEntries(depotId).find(
            (entry) =>
                entry.definitionId === definitionId ||
                entry.variantDefinitionIds?.includes(definitionId)
        )
    }
    createInventory(depotId = this.definition.id): TrainInventory {
        let nextTrainNumber = 1
        const trains = this.supplyEntries(depotId).flatMap((entry): Train[] =>
            entry.count === 'unlimited'
                ? []
                : Array.from({ length: entry.count }, () => ({
                      id: this.trainId(entry.definitionId, nextTrainNumber++, depotId),
                      definitionId: entry.definitionId,
                      status: 'depot'
                  }))
        )
        return { depotId, trains, nextTrainNumber }
    }
    remaining(inventory: TrainInventory, definitionId: string): number | 'unlimited' {
        const entry = this.supplyEntry(definitionId, inventory.depotId)
        assertExists(entry, 'Train is not supplied by this depot')
        return entry.count === 'unlimited'
            ? 'unlimited'
            : inventory.trains.filter(
                  (train) => train.definitionId === entry.definitionId && train.status === 'depot'
              ).length
    }
    nextDefinitionId(inventory: TrainInventory): string | undefined {
        return this.definition.supply.find(
            (entry) => this.remaining(inventory, entry.definitionId) !== 0
        )?.definitionId
    }
    nextTrain(inventory: TrainInventory, definitionId: string): Train | undefined {
        const entry = this.supplyEntry(definitionId, inventory.depotId)
        if (!entry) return undefined
        const train =
            entry.count === 'unlimited'
                ? {
                      id: this.trainId(
                          entry.definitionId,
                          inventory.nextTrainNumber,
                          inventory.depotId
                      ),
                      definitionId: entry.definitionId,
                      status: 'depot' as const
                  }
                : inventory.trains.find(
                      (train) =>
                          train.definitionId === entry.definitionId && train.status === 'depot'
                  )
        return train ? { ...train, definitionId } : undefined
    }
    purchase(inventory: TrainInventory, trainId: string, definitionId: string, owner: Owner): void {
        const train =
            inventory.trains.find(
                (train) =>
                    train.id === trainId &&
                    this.certificateDefinitions(train.definitionId).includes(definitionId) &&
                    train.status === 'market'
            ) ?? this.nextTrain(inventory, definitionId)
        assert(train?.id === trainId, 'This depot train is no longer available')
        this.store(inventory, { ...train, definitionId, status: 'owned', owner: { ...owner } })
    }
    export(inventory: TrainInventory, definitionId: string): Train {
        const train = this.nextTrain(inventory, definitionId)
        assert(train?.status === 'depot', 'No depot train of this kind remains')
        this.store(inventory, train)
        releaseTrains(inventory, [train.id], 'removed')
        return train
    }
    private store(inventory: TrainInventory, train: Train): void {
        const index = inventory.trains.findIndex((entry) => entry.id === train.id)
        if (index < 0) {
            inventory.trains.push(train)
            inventory.nextTrainNumber++
        } else inventory.trains[index] = train
    }
    validateInventory(
        inventory: TrainInventory,
        companyIds: readonly string[],
        playerIds: readonly string[]
    ): void {
        assert(
            new Set(inventory.trains.map((train) => train.id)).size === inventory.trains.length,
            'Duplicate train identity'
        )
        const initial = this.createInventory(inventory.depotId)
        assert(
            inventory.nextTrainNumber >= initial.nextTrainNumber,
            'Invalid train identity cursor'
        )
        for (const train of inventory.trains) {
            this.trainDefinition(train.definitionId)
            const assigned = this.definition.assignedTrains?.find((entry) => entry.id === train.id)
            if (assigned) {
                assert(
                    train.definitionId === assigned.definitionId && train.status !== 'depot',
                    'An assigned train keeps its definition and never enters the depot'
                )
            } else {
                this.validateSuppliedTrain(train, inventory, initial)
            }
            if (train.status === 'owned') {
                assert(
                    train.owner.kind !== 'company' || companyIds.includes(train.owner.companyId),
                    'Unknown train owner company'
                )
                assert(
                    train.owner.kind !== 'player' || playerIds.includes(train.owner.playerId),
                    'Unknown train owner player'
                )
            }
        }
    }
    private validateSuppliedTrain(
        train: Train,
        inventory: TrainInventory,
        initial: TrainInventory
    ) {
        const entry = this.supplyEntry(train.definitionId, inventory.depotId)
        assertExists(entry, 'Train has no supply entry')
        assert(
            train.status !== 'depot' || train.definitionId === entry.definitionId,
            'Depot stock must retain its supply definition'
        )
        if (entry.count !== 'unlimited') {
            assert(
                initial.trains.some(
                    (entry) =>
                        entry.id === train.id &&
                        this.supplyEntry(entry.definitionId)?.definitionId ===
                            this.supplyEntry(train.definitionId)?.definitionId
                ),
                'Invalid finite train identity'
            )
        } else {
            const number = Number(train.id.slice(train.id.lastIndexOf('/') + 1))
            assert(
                Number.isInteger(number) &&
                    number >= initial.nextTrainNumber &&
                    number < inventory.nextTrainNumber &&
                    train.id === this.trainId(entry.definitionId, number, inventory.depotId) &&
                    train.status !== 'depot',
                'Invalid unlimited train identity'
            )
        }
    }
    private trainId(definitionId: string, number: number, depotId = this.definition.id): string {
        return `${depotId}/${definitionId}/${number}`
    }
}
