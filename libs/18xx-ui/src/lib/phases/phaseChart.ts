import type { TrainDepot, TrainInventory } from '@tabletop/18xx'

export type PhaseChartDepotState = {
    depot: TrainDepot
    inventory: TrainInventory
    availableDefinitionIds: readonly string[]
}

export type PhaseChartData = {
    phases: {
        id: string
        tileColors: readonly string[]
        operatingRounds: number
        trainLimit: number
        notes?: string
    }[]
    trains: {
        id: string
        name: string
        price: number
        count: number | 'unlimited'
        rustPhaseId?: string
        rustNote?: string
    }[]
    notes: readonly string[]
}

export function createPhaseChart({
    phaseIds,
    tileColors,
    operatingRounds,
    trainLimits,
    depot,
    rustPhases,
    rustNotes = {},
    phaseNotes = {},
    notes = []
}: {
    phaseIds: readonly string[]
    tileColors: Readonly<Record<string, readonly string[]>>
    operatingRounds: Readonly<Record<string, number>>
    trainLimits: Readonly<Record<string, number>>
    depot: TrainDepot
    rustPhases: Readonly<Record<string, string>>
    rustNotes?: Readonly<Record<string, string>>
    phaseNotes?: Readonly<Record<string, string>>
    notes?: readonly string[]
}): PhaseChartData {
    return {
        phases: phaseIds.map((id) => ({
            id,
            tileColors: tileColors[id],
            operatingRounds: operatingRounds[id],
            trainLimit: trainLimits[id],
            notes: phaseNotes[id]
        })),
        trains: depot.definition.supply.map(({ definitionId, count }) => {
            const train = depot.trainDefinition(definitionId)
            return {
                id: train.id,
                name: train.name,
                price: train.price,
                count,
                rustPhaseId: rustPhases[train.id],
                rustNote: rustNotes[train.id]
            }
        }),
        notes
    }
}
