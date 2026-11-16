import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    OffTheRailsDieselId,
    PhasesChesapeake,
    TrainDepotChesapeake,
    offTheRails
} from '@tabletop/18chesapeake'

const PhaseNotes: Readonly<Record<string, string>> = {
    '2': 'Red areas pay their first value. Private company hexes are closed while player-owned.',
    '3': 'Companies may buy players’ privates for ½–2× face value. Red areas pay their second value.',
    '4': '2-trains rust.',
    '5': 'Privates close. Red areas pay their third value.',
    '6': '3-trains rust. D-trains on sale: $900, or $700 trading in a train.',
    D: '4-trains rust. Gray tiles. Red areas pay their fourth value.'
}

export const PhaseChartChesapeake: PhaseChartData = createPhaseChart({
    phases: PhasesChesapeake,
    depot: TrainDepotChesapeake,
    rustNotes: {},
    phaseNotes: PhaseNotes,
    notes: [
        'At the end of each set of operating rounds the next 2-, 3- or 4-train leaves the bank, starting its phase if it is the first of its kind.',
        'Trains over the limit go to the bank pool.'
    ],
    omittedTrainIds: [OffTheRailsDieselId]
})

/** Off the Rails: its own D-trains, and no exports. */
export const OffTheRailsPhaseChartChesapeake: PhaseChartData = createPhaseChart({
    phases: PhasesChesapeake,
    depot: TrainDepotChesapeake,
    rustNotes: {},
    phaseNotes: {
        ...PhaseNotes,
        '6': '3-trains rust. D-trains on sale: $1,100, or $800 trading in a train.'
    },
    notes: ['No trains are exported.', 'Trains over the limit go to the bank pool.'],
    omittedTrainIds: ['D']
})

export function phaseChartChesapeake(state: object): PhaseChartData {
    return offTheRails(state) ? OffTheRailsPhaseChartChesapeake : PhaseChartChesapeake
}
