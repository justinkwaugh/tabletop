import { createPhaseChart } from '@tabletop/18xx-ui'
import {
    EighteenNinetyFourPhases,
    EighteenNinetyFourTrainDepot,
    trainUpgrades
} from '@tabletop/1894'

export const EighteenNinetyFourPhaseChart = createPhaseChart({
    phases: EighteenNinetyFourPhases,
    depot: EighteenNinetyFourTrainDepot,
    rustNotes: {},
    // The train table's upgrade costs (§13.2).
    trainUpgrades,
    phaseNotes: {
        3: 'Companies may buy privates through phase 5+1 for ½–2× face value.',
        '5+1': 'Late companies may be started.',
        6: 'Privates close, except Saint-Quentin à Guise.',
        D: 'The next operating set is the last; it builds no track or stations. Green cities no longer split.'
    },
    notes: [
        'Once per OR, a company may upgrade a train, even at the train limit: it trades the train in for the next train in the supply when that is one colour higher, or a D, and pays the new price less half the old one’s (§7.3.7.2).'
    ]
})
