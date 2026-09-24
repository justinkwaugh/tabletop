import type { PhaseTable, TrainDepot, TrainInventory } from '@tabletop/18xx'

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
    phases,
    depot,
    rustNotes = {},
    phaseNotes = {},
    notes = []
}: {
    phases: PhaseTable
    depot: TrainDepot
    rustNotes?: Readonly<Record<string, string>>
    phaseNotes?: Readonly<Record<string, string>>
    notes?: readonly string[]
}): PhaseChartData {
    return {
        phases: phases.phases.map(({ id, tileColors, operatingRounds, trainLimit }) => ({
            id,
            tileColors,
            operatingRounds,
            trainLimit,
            notes: phaseNotes[id]
        })),
        trains: depot.definition.supply.map(({ definitionId, count }) => {
            const train = depot.trainDefinition(definitionId)
            return {
                id: train.id,
                name: train.name,
                price: train.price,
                count,
                rustPhaseId: phases.rustPhaseId(train.id),
                rustNote: rustNotes[train.id]
            }
        }),
        notes
    }
}
