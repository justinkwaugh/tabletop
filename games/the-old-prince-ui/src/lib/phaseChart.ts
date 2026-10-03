import { createPhaseChart } from '@tabletop/18xx-ui'
import { TheOldPrincePhases, TheOldPrinceTrainDepot } from '@tabletop/the-old-prince'

export const TheOldPrincePhaseChart = createPhaseChart({
    phases: TheOldPrincePhases,
    depot: TheOldPrinceTrainDepot,
    rustNotes: {
        '4+': 'At phase D, a company-owned 4+ survives only if it has had no operating opportunity. It rusts after its company’s next run step, even if unused, and cannot be traded.'
    },
    phaseNotes: {
        '2H': 'Par prices: 58, 65, 74, 80.',
        '4H': 'Hunslet Steam Engine purchasable through 3+ for up to $200 (not by PEIR).',
        '5H': '80 par removed; available: 58, 65, 74.',
        '3+': '74 par removed; available: 58, 65.',
        '4+': 'Privates close except Union Bank.',
        '7': '65 par removed; only 58 remains.'
    },
    notes: ['PEIR may buy at most one train from the bank per operating turn.']
})
