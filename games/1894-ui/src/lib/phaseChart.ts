import { createPhaseChart } from '@tabletop/18xx-ui'
import { EighteenNinetyFourPhases, EighteenNinetyFourTrainDepot } from '@tabletop/1894'

export const EighteenNinetyFourPhaseChart = createPhaseChart({
    phases: EighteenNinetyFourPhases,
    depot: EighteenNinetyFourTrainDepot,
    rustNotes: {},
    phaseNotes: {
        green: 'Companies may buy privates through the brown phase for ½–2× face value.',
        brown: 'Late companies may be started.',
        red: 'Privates close, except Saint-Quentin à Guise.',
        purple: 'The next operating set is the last; it builds no track or stations. Green cities no longer split.'
    }
})
