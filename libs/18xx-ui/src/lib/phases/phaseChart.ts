import type { PhaseTable, TrainDepot, TrainInventory } from '@tabletop/18xx'

export type PhaseChartDepotState = {
    depot: TrainDepot
    inventory: TrainInventory
    availableDefinitionIds: readonly string[]
}

export type PhaseChartData = {
    phases: {
        id: string
        /** What the rulebook calls the phase, where that is not its train. */
        name?: string
        /**
         * What starts the phase within its name, where several phases share one, as 18RoyalGorge's
         * Treaty of Boston within Green.
         */
        event?: string
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
        /** What the game ties to buying this train, beside its badge in the roster. */
        marks?: readonly TrainMark[]
        /** The trains this one may be traded in for, and what each trade costs. */
        upgrades?: readonly TrainUpgrade[]
    }[]
    notes: readonly string[]
    /** Leaves out the operating rounds per set, where rounds never come in sets, as 1880's. */
    operatingRoundsHidden?: true
}

/**
 * A mark on a train in the roster for something its purchase brings, such as 1882's rebellion,
 * drawn as an icon with an optional short label and described in full on hover.
 */
export type TrainMark = { imageUrl: string; label?: string; description: string }

/** A train a company may trade one of its trains in for, and what the trade costs. */
export type TrainUpgrade = { definitionId: string; price: number }

export type DepotCertificate = {
    definitionIds: readonly string[]
    remaining: number | 'unlimited'
}

type ChartTrain = PhaseChartData['trains'][number]

export function phaseName(chart: Pick<PhaseChartData, 'phases'>, phaseId: string): string {
    const phase = chart.phases.find((entry) => entry.id === phaseId)
    const name = phase?.name ?? phaseId
    return phase?.event ? `${name} — ${phase.event}` : name
}

export function numberedPhaseLabel(phaseIds: readonly string[]): string {
    return `Phase ${phaseIds.join(' → ')}`
}

export function phaseLabel(
    chart: Pick<PhaseChartData, 'phases'>,
    phaseIds: readonly string[]
): string {
    const phases = phaseIds.map((phaseId) => chart.phases.find((phase) => phase.id === phaseId))
    const names = phaseIds.map((phaseId, index) => phases[index]?.name ?? phaseId)
    if (names.every((name, index) => name === phaseIds[index])) return numberedPhaseLabel(phaseIds)
    const distinct = names.filter((name, index) => name !== names[index - 1])
    const event = phases.at(-1)?.event
    return `${distinct.join(' → ')} phase${event ? ` — ${event}` : ''}`
}

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
    const upgradesMatch = (first: ChartTrain, second: ChartTrain) => {
        const [these, those] = [first.upgrades ?? [], second.upgrades ?? []]
        return (
            these.length === those.length &&
            these.every(
                (upgrade, index) =>
                    upgrade.definitionId === those[index].definitionId &&
                    upgrade.price === those[index].price
            )
        )
    }
    const sharesRow = (first: ChartTrain, second: ChartTrain) =>
        first.supplyId === second.supplyId &&
        first.price === second.price &&
        upgradesMatch(first, second) &&
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
    rustTrainIds = {},
    phaseNotes = {},
    phaseNames,
    phaseEvents,
    notes = [],
    omittedPhaseIds = [],
    omittedTrainIds = [],
    permanentTrainIds = [],
    trainUpgrades,
    operatingRoundsHidden
}: {
    phases: PhaseTable
    depot: TrainDepot
    rustNotes?: Readonly<Record<string, string>>
    rustPhases?: Readonly<Record<string, string>>
    /**
     * The trains whose purchase rusts a train, where its phase starts on a later purchase of a
     * kind rather than the first, as 18MEX's second 6-train makes the 4-trains obsolete.
     */
    rustTrainIds?: Readonly<Record<string, readonly string[]>>
    phaseNotes?: Readonly<Record<string, string>>
    /** What the rulebook calls the phases, where that is not their trains. */
    phaseNames?: Readonly<Record<string, string>>
    /** What starts each phase that shares its name with others, such as a deck's event card. */
    phaseEvents?: Readonly<Record<string, string>>
    notes?: readonly string[]
    /** Phases and trains a variant leaves out, and trains it makes permanent. */
    omittedPhaseIds?: readonly string[]
    omittedTrainIds?: readonly string[]
    permanentTrainIds?: readonly string[]
    /** The trains each train may be traded in for, for a title that lists them in the roster. */
    trainUpgrades?: (trainId: string) => readonly TrainUpgrade[]
    /** Rounds never come in sets, as 1880's endless operating rounds, so the chart leaves them out. */
    operatingRoundsHidden?: true
}): PhaseChartData {
    return {
        phases: phases.phases
            .filter(({ id }) => !omittedPhaseIds.includes(id))
            .map(({ id, tileColors, operatingRounds, trainLimit }) => ({
                id,
                ...(phaseNames?.[id] ? { name: phaseNames[id] } : {}),
                ...(phaseEvents?.[id] ? { event: phaseEvents[id] } : {}),
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
                          rustTrainIds: rustPhaseId
                              ? (rustTrainIds[train.id] ?? phases.phase(rustPhaseId).startedBy)
                              : [],
                          rustNote: rustNotes[train.id],
                          upgrades: trainUpgrades?.(train.id)
                      }
                  })
        ),
        notes,
        ...(operatingRoundsHidden ? { operatingRoundsHidden } : {})
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
