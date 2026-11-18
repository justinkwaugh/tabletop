import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    CobourgTrainId,
    DieselTrainId,
    PhaseColorNames1828,
    Phases1828,
    TrainDepot1828
} from '@tabletop/1828'

// The phases are named by their colours (§17).
export const PhaseChart1828: PhaseChartData = createPhaseChart({
    phases: Phases1828,
    depot: TrainDepot1828,
    phaseNames: PhaseColorNames1828,
    phaseNotes: {
        '2': 'Companies start at the yellow pars.',
        '3': 'Green pars open. Companies may buy players’ saleable privates for $1 to twice face value.',
        '5': 'Blue pars open. 2-trains rust.',
        '3+D': 'Brown pars open. Revenue centers pay their second value.',
        '6': 'Every private closes. 3-trains rust.',
        '8E': '5-trains rust.',
        [DieselTrainId]:
            '3+D-trains rust. No company may start; the first purple stock round removes the companies never parred, blocking stations taking their homes. The first set of operating rounds in purple is the last.'
    },
    notes: [
        'A system’s train limit applies to each of its two shells.',
        'Trains over the limit are removed from the game.',
        'A share price reaching $500 ends the game.'
    ],
    omittedTrainIds: [CobourgTrainId]
})
