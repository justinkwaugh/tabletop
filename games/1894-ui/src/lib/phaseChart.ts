import { createPhaseChart } from '@tabletop/18xx-ui'
import { EighteenNinetyFourPhases, EighteenNinetyFourTrainDepot } from '@tabletop/1894'

export const EighteenNinetyFourPhaseChart = createPhaseChart({
    phases: EighteenNinetyFourPhases,
    depot: EighteenNinetyFourTrainDepot,
    rustNotes: {},
    phaseNotes: {
        3: 'Companies may buy privates through phase 5+1 for ½–2× face value.',
        '5+1': 'Late companies may be started.',
        6: 'Privates close, except Saint-Quentin à Guise.',
        D: 'The next operating set is the last; it builds no track or stations. Green cities no longer split.'
    }
})
