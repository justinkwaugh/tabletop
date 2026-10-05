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
        supplyId: string
        rustTrainIds: readonly string[]
        rustPhaseId?: string
        rustNote?: string
    }[]
    notes: readonly string[]
}

export function createPhaseChart({
    phases,
    depot,
    rustNotes = {},
    rustPhases = {},
    phaseNotes = {},
    notes = []
}: {
    phases: PhaseTable
    depot: TrainDepot
    rustNotes?: Readonly<Record<string, string>>
    rustPhases?: Readonly<Record<string, string>>
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
        trains: depot.definition.supply.flatMap(({ definitionId }) =>
            depot.certificateDefinitions(definitionId).map((id) => {
                const train = depot.trainDefinition(id)
                const rustPhaseId = rustPhases[train.id] ?? phases.rustPhaseId(train.id)
                return {
                    id: train.id,
                    name: train.name,
                    price: train.price,
                    supplyId: definitionId,
                    rustPhaseId,
                    rustTrainIds: rustPhaseId ? phases.phase(rustPhaseId).startedBy : [],
                    rustNote: rustNotes[train.id]
                }
            })
        ),
        notes
    }
}
