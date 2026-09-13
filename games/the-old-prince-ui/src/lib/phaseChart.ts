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
        '4H': 'Harbour Shipping purchasable through 3+ for up to $200 (not by PEIR).',
        '4+': 'Privates close except Union Bank and King’s Mail.'
    },
    notes: ['PEIR may buy at most one train per operating turn.']
})
