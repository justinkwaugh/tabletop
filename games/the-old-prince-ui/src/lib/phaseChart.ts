import { createPhaseChart } from '@tabletop/18xx-ui'
import {
    TheOldPrincePhases, TheOldPrinceTrackColors, TheOldPrinceOperatingRoundCounts,
    TheOldPrinceTrainLimits, TheOldPrinceTrainDepot, TheOldPrinceTrainRustPhases
} from '@tabletop/the-old-prince'

export const TheOldPrincePhaseChart = createPhaseChart({
    phaseIds: TheOldPrincePhases,
    tileColors: TheOldPrinceTrackColors,
    operatingRounds: TheOldPrinceOperatingRoundCounts,
    trainLimits: TheOldPrinceTrainLimits,
    depot: TheOldPrinceTrainDepot,
    rustPhases: TheOldPrinceTrainRustPhases,
    rustNotes: { '4+': 'At phase D, a never-run, company-owned 4+ survives until its company’s next run step, then rusts. It cannot be traded.' },
    phaseNotes: {
        '2H': 'Par prices: 58, 65, 74, 80.',
        '4H': 'Hunslet Steam Engine purchasable through 3+ for up to $200 (not by PEIR).',
        '5H': '80 par removed; available: 58, 65, 74.',
        '3+': '74 par removed; available: 58, 65.',
        '4+': 'Privates close except Union Bank and King’s Mail.',
        '7': '65 par removed; only 58 remains.'
    },
    notes: ['PEIR may buy at most one train from the bank per operating turn.']
})
