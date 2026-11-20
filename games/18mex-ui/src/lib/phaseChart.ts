import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    FourDId,
    MinorTrainId,
    PhasesMex,
    SixHalfPhaseId,
    ThreeHalfPhaseId,
    TrainDepotMex
} from '@tabletop/18mex'

// Table I's phases; 3½ and 6½ start with the fifth 3-train and the second 6-train.
export const PhaseChartMex: PhaseChartData = createPhaseChart({
    phases: PhasesMex,
    depot: TrainDepotMex,
    // The minors' 2-trains are printed on their charters, outside the bank's supply.
    omittedTrainIds: [MinorTrainId],
    rustPhases: { '4': SixHalfPhaseId },
    rustTrainIds: { '4': ['6'] },
    rustNotes: { '4': 'obsolete with the second 6-train, running once more' },
    phaseEvents: {
        [ThreeHalfPhaseId]: 'minors close',
        '5': 'NdM merger',
        [SixHalfPhaseId]: '4s obsolete'
    },
    phaseNotes: {
        '2': 'Yellow tiles. A major buys at most one train from the bank a turn. NdM stock is not on sale. Red areas and the gray cities pay their lower value.',
        '3': 'Green tiles, for majors only. Majors may buy privates, but the MNR, for ½–1½× face value.',
        [ThreeHalfPhaseId]:
            'Starts with the fifth 3-train. The minors close: A’s and B’s owners receive a 5% NdM, C’s a 10% UdY, and each minor’s money goes to that major. NdM stock goes on sale; the NdM may own 4 trains.',
        '4': '2-trains rust. Train limit 2, the NdM’s 3. Majors may buy several trains from the bank a turn.',
        '5': 'Brown tiles. Privates close. The NdM merger. Red areas and the gray cities pay their higher value.',
        '6': '3-trains rust.',
        [SixHalfPhaseId]:
            'Starts with the second 6-train. 4-trains in the Open Market leave; those companies own run once more, then leave.',
        [FourDId]: 'The gray tile. A 4D doubles its cities and red areas, not its towns.'
    },
    notes: [
        'Towns never count toward a train’s length.',
        'A major owning a train collects its home city’s value as mail before laying track.'
    ]
})
