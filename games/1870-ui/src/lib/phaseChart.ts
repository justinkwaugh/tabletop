import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { Phases1870, TrainDepot1870, type State1870 } from '@tabletop/1870'

const PhaseNotes = {
    '1': 'Only the Missouri Pacific or St. Louis Southwestern may buy a private: the bridge, for $20–$40.',
    '2': 'Companies may buy players’ privates for ½–2× face value.',
    '4': 'Privates close. Red off-boards pay their middle value.',
    '5': 'Port and Cattle tokens are removed.',
    '6': 'Red off-boards pay their bottom value.'
}

export const PhaseChart1870 = createPhaseChart({
    phases: Phases1870,
    depot: TrainDepot1870,
    phaseNotes: PhaseNotes,
    omittedTrainIds: ['D']
})

// With diesels the 8s, 10s and 12s are gone, diesels sell from phase 5, and the first starts
// phase 6, the last; 5-trains are permanent (p. 24).
const DieselPhaseChart = createPhaseChart({
    phases: Phases1870,
    depot: TrainDepot1870,
    omittedPhaseIds: ['7', '8'],
    omittedTrainIds: ['8', '10', '12'],
    permanentTrainIds: ['5'],
    rustNotes: { D: 'Diesel: runs any distance; a 4, 5 or 6 is taken in trade for $300 off.' },
    phaseNotes: {
        ...PhaseNotes,
        '5': 'Port and Cattle tokens are removed. Diesels go on sale.'
    }
})

export function phaseChart1870(state: State1870): PhaseChartData {
    return state.variants.diesels ? DieselPhaseChart : PhaseChart1870
}
