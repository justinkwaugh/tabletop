import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    EighteenThirtyTwoPhases,
    EighteenThirtyTwoTrainDepot,
    type EighteenThirtyTwoState
} from '@tabletop/1832'

const PhaseNotes = {
    '2': 'Companies may buy only the West Virginia Coal Fields, for ½–1× face value.',
    '3': 'Companies may buy players’ privates for ½–2× face value.',
    '5': 'Privates close. Offboards and the coal fields pay their second value.',
    '6': 'Port and Cotton tokens are removed.',
    '8': 'Offboards pay their last value.'
}

export const EighteenThirtyTwoPhaseChart = createPhaseChart({
    phases: EighteenThirtyTwoPhases,
    depot: EighteenThirtyTwoTrainDepot,
    phaseNotes: PhaseNotes
})

// With diesels, the 8- and 10-trains and their phases are gone, 12-trains sell as diesels from
// the first 6-train, and 5-trains are permanent (§17.2).
const DieselPhaseChart = createPhaseChart({
    phases: EighteenThirtyTwoPhases,
    depot: EighteenThirtyTwoTrainDepot,
    omittedPhaseIds: ['8', '10'],
    omittedTrainIds: ['8', '10'],
    permanentTrainIds: ['5'],
    rustPhases: { '4': '12' },
    rustNotes: { '12': 'Diesel: a 4-, 5- or 6-train is taken in trade for $300 off.' },
    phaseNotes: {
        '2': PhaseNotes['2'],
        '3': PhaseNotes['3'],
        '5': PhaseNotes['5'],
        '6': 'Port and Cotton tokens are removed. Diesels go on sale.',
        '12': 'Offboards pay their last value; the Key West token is removed.'
    }
})

export function eighteenThirtyTwoPhaseChart(state: EighteenThirtyTwoState): PhaseChartData {
    return state.variants.diesels ? DieselPhaseChart : EighteenThirtyTwoPhaseChart
}
