import { createPhaseChart } from '@tabletop/18xx-ui'
import { EighteenThirtyTwoPhases, EighteenThirtyTwoTrainDepot } from '@tabletop/1832'

export const EighteenThirtyTwoPhaseChart = createPhaseChart({
    phases: EighteenThirtyTwoPhases,
    depot: EighteenThirtyTwoTrainDepot,
    rustNotes: {},
    phaseNotes: {
        '2': 'Companies may buy only the West Virginia Coal Fields, for ½–1× face value.',
        '3': 'Companies may buy players’ privates for ½–2× face value.',
        '5': 'Privates close. Offboards and the coal fields pay their second value.',
        '6': 'Port and Cotton tokens are removed.',
        '8': 'Offboards pay their last value.'
    }
})
