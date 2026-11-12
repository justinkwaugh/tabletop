import { createPhaseChart } from '@tabletop/18xx-ui'
import { Phases1849, TrainDepot1849 } from '@tabletop/1849'

// What each phase changes (§6, §7.1, §9.4, §10.5.2, §12).
export const PhaseChart1849 = createPhaseChart({
    phases: Phases1849,
    depot: TrainDepot1849,
    phaseNotes: {
        '4H': 'Corporations start at L. 68 or L. 100. Grey cities pay their lowest value.',
        '6H': 'Corporations may buy players’ privates for L. 1 to twice face value, and start at L. 144.',
        '8H': 'Grey cities pay their middle value.',
        '10H': 'Corporations may start at L. 216.',
        '12H': 'Privates close. The Messina earthquake. Grey cities pay their highest value.',
        '16H': 'R6H trains go on sale. Share prices may enter the blue zone.'
    }
})
