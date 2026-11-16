import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    DieselId,
    EightTrainId,
    Phases1856,
    TrainDepot1856,
    requireState1856
} from '@tabletop/1856'

const PhaseNotes: Readonly<Record<string, string>> = {
    '2': 'Red areas pay their first value. New companies are capitalized with escrow.',
    '3': 'Companies may buy players’ privates for ½–2× cost.',
    '4': '2-trains rust.',
    '5': 'Privates close. Red areas pay their second value.',
    '6': 'The CGR forms as the buyer’s turn ends. Loans end; the port token goes. 3-trains rust. Small cities may be upgraded or downgraded.',
    D: '4-trains rust. Red areas pay their third value.',
    '8': '4-trains rust. Red areas pay their third value.'
}

const Notes = [
    'Companies started while a 2, 3 or 4 is on sale hold back the money for their shares beyond the fifth in escrow until they reach their destinations; with a 5 on sale they receive it as sold; from the 6s, ten times par as they first operate.',
    'To operate for the first time a company needs as many shares sold as the train on sale, a Diesel counting as a 6.',
    'Trains over the limit go to the open market.'
]

const DieselChart: PhaseChartData = createPhaseChart({
    phases: Phases1856,
    depot: TrainDepot1856,
    phaseNotes: {
        ...PhaseNotes,
        '6': `${PhaseNotes['6']} Diesels on sale: $1,100, or $750 trading in a 4, 5 or 6.`
    },
    notes: Notes,
    omittedPhaseIds: [EightTrainId],
    omittedTrainIds: [EightTrainId]
})

const EightTrainChart: PhaseChartData = createPhaseChart({
    phases: Phases1856,
    depot: TrainDepot1856,
    phaseNotes: {
        ...PhaseNotes,
        '6': `${PhaseNotes['6']} 8-trains on sale: $1,000, or $650 trading in a 4, 5 or 6.`
    },
    notes: Notes,
    omittedPhaseIds: [DieselId],
    omittedTrainIds: [DieselId]
})

export const PhaseChart1856 = DieselChart

export function phaseChart1856(state: object): PhaseChartData {
    return requireState1856(state).variants.eightTrains ? EightTrainChart : DieselChart
}
