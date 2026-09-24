import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Clone } from 'typebox/value'
import { assert, assertExists, deepFreeze } from '@tabletop/common'
import { TrainDefinition, type Train, type TrainInventory } from './train.js'
import type { Owner } from '../finance/finance.js'
const SupplyEntry = Type.Object(
    {
        definitionId: Type.String({ minLength: 1 }),
        count: Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('unlimited')])
    },
    { additionalProperties: false }
)
export const TrainDepotDefinition = Type.Object(
    {
        id: Type.String({ minLength: 1 }),
        trains: Type.Array(TrainDefinition),
        supply: Type.Array(SupplyEntry)
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
        assert(
            definition.supply.every((entry) =>
                definition.trains.some((train) => train.id === entry.definitionId)
            ),
            'Unknown train supply definition'
        )
        this.definition = Clone(definition)
        deepFreeze(this.definition)
    }
    trainDefinition(id: string): TrainDefinition {
        const definition = this.definition.trains.find((train) => train.id === id)
        assertExists(definition, 'Unknown train definition')
        return definition
    }
    createInventory(): TrainInventory {
        let nextTrainNumber = 1
        const trains = this.definition.supply.flatMap((entry): Train[] =>
            entry.count === 'unlimited'
                ? []
                : Array.from({ length: entry.count }, () => ({
                      id: this.trainId(entry.definitionId, nextTrainNumber++),
                      definitionId: entry.definitionId,
                      status: 'depot'
                  }))
        )
        return { depotId: this.definition.id, trains, nextTrainNumber }
    }
    remaining(inventory: TrainInventory, definitionId: string): number | 'unlimited' {
        const entry = this.definition.supply.find((entry) => entry.definitionId === definitionId)
        assertExists(entry, 'Train is not supplied by this depot')
        return entry.count === 'unlimited'
            ? 'unlimited'
            : inventory.trains.filter(
                  (train) => train.definitionId === definitionId && train.status === 'depot'
              ).length
    }
    nextDefinitionId(inventory: TrainInventory): string | undefined {
        return this.definition.supply.find(
            (entry) => this.remaining(inventory, entry.definitionId) !== 0
        )?.definitionId
    }
    nextTrain(inventory: TrainInventory, definitionId: string): Train | undefined {
        const entry = this.definition.supply.find((entry) => entry.definitionId === definitionId)
        if (!entry) return undefined
        return entry.count === 'unlimited'
            ? {
                  id: this.trainId(definitionId, inventory.nextTrainNumber),
                  definitionId,
                  status: 'depot'
              }
            : inventory.trains.find(
                  (train) => train.definitionId === definitionId && train.status === 'depot'
              )
    }
    purchase(inventory: TrainInventory, trainId: string, definitionId: string, owner: Owner): void {
        const train =
            inventory.trains.find(
                (train) =>
                    train.id === trainId &&
                    train.definitionId === definitionId &&
                    train.status === 'market'
            ) ?? this.nextTrain(inventory, definitionId)
        assert(train?.id === trainId, 'This depot train is no longer available')
        const owned: Train = { ...train, status: 'owned', owner: { ...owner } }
        const index = inventory.trains.findIndex((entry) => entry.id === trainId)
        if (index < 0) {
            inventory.trains.push(owned)
            inventory.nextTrainNumber++
        } else inventory.trains[index] = owned
    }
    validateInventory(
        inventory: TrainInventory,
        companyIds: readonly string[],
        playerIds: readonly string[]
    ): void {
        assert(inventory.depotId === this.definition.id, 'Wrong train depot')
        assert(
            new Set(inventory.trains.map((train) => train.id)).size === inventory.trains.length,
            'Duplicate train identity'
        )
        const initial = this.createInventory()
        assert(
            inventory.nextTrainNumber >= initial.nextTrainNumber,
            'Invalid train identity cursor'
        )
        for (const train of inventory.trains) {
            this.trainDefinition(train.definitionId)
            const entry = this.definition.supply.find(
                (entry) => entry.definitionId === train.definitionId
            )
            assertExists(entry, 'Train has no supply entry')
            if (entry.count !== 'unlimited') {
                assert(
                    initial.trains.some(
                        (entry) =>
                            entry.id === train.id && entry.definitionId === train.definitionId
                    ),
                    'Invalid finite train identity'
                )
            } else {
                const number = Number(train.id.slice(train.id.lastIndexOf('/') + 1))
                assert(
                    Number.isInteger(number) &&
                        number >= initial.nextTrainNumber &&
                        number < inventory.nextTrainNumber &&
                        train.id === this.trainId(train.definitionId, number) &&
                        train.status !== 'depot',
                    'Invalid unlimited train identity'
                )
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
        assert(
            initial.trains.every((train) =>
                inventory.trains.some((entry) => entry.id === train.id)
            ),
            'Missing finite train'
        )
    }
    private trainId(definitionId: string, number: number): string {
        return `${this.definition.id}/${definitionId}/${number}`
    }
}
