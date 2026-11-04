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

export type DepotCertificate = {
    definitionIds: readonly string[]
    remaining: number | 'unlimited'
}

export type TrainRosterRow = {
    train: PhaseChartData['trains'][number]
    remainingRowSpan: number
    rustRowSpan: number
}

function facesByPrice(depot: TrainDepot, definitionId: string) {
    return depot
        .certificateDefinitions(definitionId)
        .map((id) => depot.trainDefinition(id))
        .toSorted((first, second) => first.price - second.price)
}

export function currentDepotCertificates({
    depot,
    inventory,
    availableDefinitionIds
}: PhaseChartDepotState): DepotCertificate[] {
    const inStock = availableDefinitionIds.filter((id) => depot.remaining(inventory, id) !== 0)
    const certificateIdOf = (id: string) => depot.certificateDefinitions(id)[0]
    return [...new Set(inStock.map(certificateIdOf))].map((certificateId) => ({
        definitionIds: facesByPrice(depot, certificateId)
            .map(({ id }) => id)
            .filter((id) => inStock.includes(id)),
        remaining: depot.remaining(inventory, certificateId)
    }))
}

export function trainRosterRows(trains: PhaseChartData['trains']): TrainRosterRow[] {
    return trains.map((train) => {
        const faces = trains.filter((face) => face.supplyId === train.supplyId)
        const certificateRowSpan = faces[0] === train ? faces.length : 0
        const sameRust = faces.every(
            (face) => face.rustPhaseId === train.rustPhaseId && face.rustNote === train.rustNote
        )
        return {
            train,
            remainingRowSpan: certificateRowSpan,
            rustRowSpan: sameRust ? certificateRowSpan : 1
        }
    })
}

export function createPhaseChart({
    phases,
    depot,
    rustNotes = {},
    rustPhases = {},
    phaseNotes = {},
    notes = [],
    omittedPhaseIds = [],
    omittedTrainIds = [],
    permanentTrainIds = []
}: {
    phases: PhaseTable
    depot: TrainDepot
    rustNotes?: Readonly<Record<string, string>>
    rustPhases?: Readonly<Record<string, string>>
    phaseNotes?: Readonly<Record<string, string>>
    notes?: readonly string[]
    /** Phases and trains a variant leaves out, and trains it makes permanent. */
    omittedPhaseIds?: readonly string[]
    omittedTrainIds?: readonly string[]
    permanentTrainIds?: readonly string[]
}): PhaseChartData {
    return {
        phases: phases.phases
            .filter(({ id }) => !omittedPhaseIds.includes(id))
            .map(({ id, tileColors, operatingRounds, trainLimit }) => ({
                id,
                tileColors,
                operatingRounds,
                trainLimit,
                notes: phaseNotes[id]
            })),
        trains: depot.definition.supply.flatMap(({ definitionId }) =>
            omittedTrainIds.includes(definitionId)
                ? []
                : facesByPrice(depot, definitionId).map((train) => {
                      const rustPhaseId = permanentTrainIds.includes(train.id)
                          ? undefined
                          : (rustPhases[train.id] ?? phases.rustPhaseId(train.id))
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
