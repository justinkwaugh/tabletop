import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { Phases1862, TrainDepot1862, kindLimit } from '@tabletop/1862'

/** The train limit counts each type of train, or from phase G all trains together (§7.9). */
function trainLimit(phaseId: string): { count: number; note: string } {
    const limit = kindLimit(phaseId)
    return 'perKind' in limit
        ? { count: limit.perKind, note: `Limit: ${limit.perKind} of each type of train.` }
        : { count: limit.total, note: `Limit: ${limit.total} trains in all, of any type.` }
}

// Off-boards pay their lowest value in A–B, middle in C–D and highest after (§9); four more
// companies become available in each of B and C (§2.4.1).
const PhaseNotes: Readonly<Record<string, string>> = {
    A: 'Off-boards pay their lowest value.',
    B: 'Four more companies become available.',
    C: 'Four more companies become available. Off-boards pay their middle value.',
    E: 'Off-boards pay their highest value.',
    H: 'The LNER forms after this set of operating rounds; share sales no longer move prices.'
}

const chart = createPhaseChart({
    phases: Phases1862,
    depot: TrainDepot1862,
    notes: [
        'Each train runs as Express, Local or Freight, chosen when it is bought; a company runs only the types it holds a permit for.',
        'A and D trains come with a free warranty. A warrantied train rusts only once its last warranty is removed, one after each run (§7.10).',
        'Once a later band is sold, earlier-band trains change hands at half their face value.'
    ]
})

export const PhaseChart1862: PhaseChartData = {
    ...chart,
    phases: chart.phases.map((phase) => {
        const limit = trainLimit(phase.id)
        return {
            ...phase,
            trainLimit: limit.count,
            notes: [limit.note, PhaseNotes[phase.id]].filter(Boolean).join(' ')
        }
    })
}
