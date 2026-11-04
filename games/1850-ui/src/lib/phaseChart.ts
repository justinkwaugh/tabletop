import { createDieselPhaseChart, createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { DieselVariant1850, Phases1850, TrainDepot1850, type State1850 } from '@tabletop/1850'

const LastValues = 'Off-boards and the Mesabi Range pay their last value.'

const PhaseNotes = {
    '2': 'Companies may buy only MRBC and MMC, for ½–1× face value.',
    '3': 'Companies may buy players’ privates for ½–2× face value.',
    '5': 'GRSC, MRBC, MMC and MMR close; CM, GBCC and WLGC pay no more income. Off-boards and the Mesabi Range pay their second value.',
    '6': 'All privates close.',
    '8': LastValues,
    D: LastValues
}

export const PhaseChart1850 = createPhaseChart({
    phases: Phases1850,
    depot: TrainDepot1850,
    phaseNotes: PhaseNotes,
    omittedPhaseIds: ['D'],
    omittedTrainIds: ['D']
})

// With diesels the 8s, 10s and 12s are gone, diesels sell from the first 6, and the first diesel
// starts the last phase; 5-trains are permanent (§16.2).
export const DieselPhaseChart = createDieselPhaseChart({
    diesel: DieselVariant1850.terms,
    phases: Phases1850,
    depot: TrainDepot1850,
    phaseNotes: { ...PhaseNotes, '6': 'All privates close. Diesels go on sale.' }
})

export function phaseChart1850(state: State1850): PhaseChartData {
    return state.variants.diesels ? DieselPhaseChart : PhaseChart1850
}
