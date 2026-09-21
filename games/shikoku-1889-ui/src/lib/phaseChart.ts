import { createPhaseChart } from '@tabletop/18xx-ui'
import { Shikoku1889Phases, Shikoku1889TrainDepot } from '@tabletop/shikoku-1889'

export const Shikoku1889PhaseChart = createPhaseChart({
    phases: Shikoku1889Phases,
    depot: Shikoku1889TrainDepot,
    rustNotes: {},
    phaseNotes: {
        '3': 'Companies may buy privates through phase 4 for ½–2× face value.',
        '5': 'Privates close. Player-owned Uno–Takamatsu Ferry stays open, pays ¥50 and cannot be sold.',
        '6': 'Diesels available. Exchange a 4, 5 or 6 for a ¥800 diesel.'
    }
})
