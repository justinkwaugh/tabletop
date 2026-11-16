import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { Phases1882, TrainDepot1882, rebellionTrainOrdinal, type State1882 } from '@tabletop/1882'
import RebellionIcon from './images/icons/NWR.svg'

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

export const PhaseChart1882: PhaseChartData = createPhaseChart({
    phases: Phases1882,
    depot: TrainDepot1882,
    rustNotes: {},
    phaseNotes: PhaseNotes,
    notes: Notes
})

/**
 * The chart with the rebellion's train marked until the rebellion comes: the first of the kind
 * drawn at setup, or the second once the Saskatchewan Central added one on top (§3, §7.1.2).
 */
export function phaseChart1882(
    state: Pick<State1882, 'rebellion' | 'trainInventory'>
): PhaseChartData {
    const { definitionId, occurred } = state.rebellion
    if (occurred) return PhaseChart1882
    const second = rebellionTrainOrdinal(state) === 2
    const mark = {
        imageUrl: RebellionIcon,
        ...(second ? { label: '2nd' } : {}),
        description: `The North-West Rebellion comes with the ${second ? 'second' : 'first'} ${definitionId}-train bought, removing the yellow tiles laid in the rebellion hexes.`
    }
    return {
        ...PhaseChart1882,
        trains: PhaseChart1882.trains.map((train) =>
            train.id === definitionId ? { ...train, marks: [mark] } : train
        )
    }
}
