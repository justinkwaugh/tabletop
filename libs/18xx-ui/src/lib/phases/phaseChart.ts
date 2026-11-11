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

type ChartTrain = PhaseChartData['trains'][number]

export type TrainRosterRow = {
    /** The faces of one certificate that cost the same and rust together. */
    faces: ChartTrain[]
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

export function marketCertificates({
    depot,
    inventory
}: Pick<PhaseChartDepotState, 'depot' | 'inventory'>): DepotCertificate[] {
    return depot.definition.supply
        .map(({ definitionId }) => {
            const faces = facesByPrice(depot, definitionId).map(({ id }) => id)
            return {
                definitionIds: faces,
                remaining: inventory.trains.filter(
                    (train) => train.status === 'market' && faces.includes(train.definitionId)
                ).length
            }
        })
        .filter(({ remaining }) => remaining > 0)
}

export function certificateRemaining(
    certificates: readonly DepotCertificate[],
    definitionId: string
): DepotCertificate['remaining'] {
    return (
        certificates.find(({ definitionIds }) => definitionIds.includes(definitionId))?.remaining ??
        0
    )
}

export function trainRosterRows(trains: PhaseChartData['trains']): TrainRosterRow[] {
    const rustsWith = (first: ChartTrain, second: ChartTrain) =>
        first.rustPhaseId === second.rustPhaseId && first.rustNote === second.rustNote
    const sharesRow = (first: ChartTrain, second: ChartTrain) =>
        first.supplyId === second.supplyId &&
        first.price === second.price &&
        rustsWith(first, second)
    const rows = trains
        .filter((train) => trains.find((face) => sharesRow(face, train)) === train)
        .map((first) => trains.filter((face) => sharesRow(face, first)))
    return rows.map((faces) => {
        const certificate = rows.filter(([face]) => face.supplyId === faces[0].supplyId)
        const certificateRowSpan = certificate[0] === faces ? certificate.length : 0
        return {
            faces,
            remainingRowSpan: certificateRowSpan,
            rustRowSpan: certificate.every(([face]) => rustsWith(face, faces[0]))
                ? certificateRowSpan
                : 1
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

/**
 * The chart of a game with 1830-style diesels replacing its largest trains (1870, 1850): the diesel
 * starts the last phase and scraps the 4s, the 5s become permanent.
 */
export function createDieselPhaseChart({
    phases,
    depot,
    phaseNotes,
    diesel
}: Pick<Parameters<typeof createPhaseChart>[0], 'phases' | 'depot' | 'phaseNotes'> & {
    /** The variant's own terms, from ``dieselVariant``. */
    diesel: {
        dieselId: string
        tradeInIds: readonly string[]
        credit: number
        removedIds: readonly string[]
        unsoldId: string
        permanentId: string
    }
}) {
    const goneIds = [...diesel.removedIds, diesel.unsoldId]
    const tradeIns = new Intl.ListFormat('en', { type: 'disjunction' }).format(diesel.tradeInIds)
    return createPhaseChart({
        phases,
        depot,
        omittedPhaseIds: goneIds,
        omittedTrainIds: goneIds,
        permanentTrainIds: [diesel.permanentId],
        rustPhases: { '4': diesel.dieselId },
        rustNotes: {
            [diesel.dieselId]: `Diesel: runs any distance; a ${tradeIns} is taken in trade for $${diesel.credit} off.`
        },
        phaseNotes
    })
}
