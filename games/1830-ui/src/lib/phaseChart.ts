import { createPhaseChart } from '@tabletop/18xx-ui'
import { EighteenThirtyPhases, EighteenThirtyTrainDepot } from '@tabletop/1830'

export const EighteenThirtyPhaseChart = createPhaseChart({
    phases: EighteenThirtyPhases,
    depot: EighteenThirtyTrainDepot,
    rustNotes: {},
    phaseNotes: {
        '3': 'Companies may buy privates through phase 4 for ½–2× face value.',
        '5': 'Privates close.',
        '6': 'Diesels available. Exchange a 4, 5 or 6 for an $800 diesel.'
    }
})
