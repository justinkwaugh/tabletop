import { createPhaseChart } from '@tabletop/18xx-ui'
import { Phases1882, TrainDepot1882 } from '@tabletop/1882'

const PhaseNotes: Readonly<Record<string, string>> = {
    '2': 'Red areas pay their first value. Private company hexes are closed while player-owned.',
    '3': 'Companies may buy players’ privates for ½–2× face value.',
    '4': '2-trains rust.',
    '5': 'Privates close, except the Saskatchewan Central. Red areas pay their second value.',
    '6': '3-trains rust. The Saskatchewan Central closes. D-trains on sale: trade a 4, 5 or 6 for $800.',
    D: '4-trains rust.'
}

const Notes = [
    'The North-West Rebellion removes the yellow tiles from the rebellion hexes when its train is bought: the first of the kind drawn at setup, or the second if the Saskatchewan Central added one on top.',
    'Trains over the limit leave the game.'
]

export const PhaseChart1882 = createPhaseChart({
    phases: Phases1882,
    depot: TrainDepot1882,
    rustNotes: {},
    phaseNotes: PhaseNotes,
    notes: Notes
})
