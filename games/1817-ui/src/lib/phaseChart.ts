import { createPhaseChart } from '@tabletop/18xx-ui'
import { EighteenSeventeenPhases, EighteenSeventeenTrainDepot } from '@tabletop/1817'

export const EighteenSeventeenPhaseChart = createPhaseChart({
    phases: EighteenSeventeenPhases,
    depot: EighteenSeventeenTrainDepot,
    rustNotes: { '2+': 'Obsolete on the 4: runs once more, then rusts.' },
    phaseNotes: {
        '2': 'Companies start with 2 shares.',
        '3': 'Companies start with 2 or 5 shares.',
        '4': 'Companies start with 5 shares.',
        '5': 'Companies start with 5 or 10 shares.',
        '6': 'Companies start with 10 shares.',
        '8': 'No new shorts.'
    },
    notes: [
        'Companies are started by auction for $100–$400; the bid becomes the treasury.',
        'The second tile lay in a turn costs $20; only one may be an upgrade.'
    ]
})
