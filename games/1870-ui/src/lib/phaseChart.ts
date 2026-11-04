import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { Phases1870, TrainDepot1870, type State1870 } from '@tabletop/1870'

const BottomValues = 'Red off-boards pay their bottom value.'

const PhaseNotes = {
    '2': 'Only the Missouri Pacific or St. Louis Southwestern may buy a private: the bridge, for $20–$40.',
    '3': 'Companies may buy players’ privates for ½–2× face value.',
    '5': 'Privates close. Red off-boards pay their middle value.',
    '6': 'Port and Cattle tokens are removed.',
    '8': BottomValues,
    D: BottomValues
}

export const PhaseChart1870 = createPhaseChart({
    phases: Phases1870,
    depot: TrainDepot1870,
    phaseNotes: PhaseNotes,
    omittedPhaseIds: ['D'],
    omittedTrainIds: ['D']
})

// With diesels the 8s, 10s and 12s are gone, diesels sell from the first 6, and the first diesel
// starts the last phase; 5-trains are permanent (p. 24).
export const DieselPhaseChart = createPhaseChart({
    phases: Phases1870,
    depot: TrainDepot1870,
    omittedPhaseIds: ['8', '10', '12'],
    omittedTrainIds: ['8', '10', '12'],
    permanentTrainIds: ['5'],
    rustPhases: { '4': 'D' },
    rustNotes: { D: 'Diesel: runs any distance; a 4, 5 or 6 is taken in trade for $300 off.' },
    phaseNotes: {
        ...PhaseNotes,
        '6': 'Port and Cattle tokens are removed. Diesels go on sale.'
    }
})

export function phaseChart1870(state: State1870): PhaseChartData {
    return state.variants.diesels ? DieselPhaseChart : PhaseChart1870
}
