import { createPhaseChart } from '@tabletop/18xx-ui'
import {
    Shikoku1889Phases, Shikoku1889TrackColors, Shikoku1889OperatingRoundCounts,
    Shikoku1889TrainLimits, Shikoku1889TrainDepot, Shikoku1889TrainRustPhases
} from '@tabletop/shikoku-1889'

export const Shikoku1889PhaseChart = createPhaseChart({
    phaseIds: Shikoku1889Phases,
    tileColors: Shikoku1889TrackColors,
    operatingRounds: Shikoku1889OperatingRoundCounts,
    trainLimits: Shikoku1889TrainLimits,
    depot: Shikoku1889TrainDepot,
    rustPhases: Shikoku1889TrainRustPhases,
    rustNotes: {},
    phaseNotes: {
        '3': 'Companies may buy privates through phase 4 for ½–2× face value.',
        '5': 'Privates close. Player-owned Uno–Takamatsu Ferry stays open, pays $50 and cannot be sold.',
        '6': 'Diesels available. Exchange a 4, 5 or 6 for an $800 diesel.'
    }
})
