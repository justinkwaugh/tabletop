import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { Phases1860, TrainDepot1860 } from '@tabletop/1860'

// Phases, Buying Trains, The Fishbourne Ferry Company, Phase 8, Formation of the Southern Railway.
export const PhaseChart1860: PhaseChartData = createPhaseChart({
    phases: Phases1860,
    depot: TrainDepot1860,
    phaseNotes: {
        '2': 'Yellow tiles. One operating round between stock rounds. Train limit 4.',
        '3': 'Green tiles. Two operating rounds.',
        '4': '2+1 trains rust. Train limit 3; trains over it return to the bank as their company’s next turn begins.',
        '5': 'Russet tiles. Three operating rounds.',
        '6': '3+2 trains rust. Train limit 2. The Fishbourne Ferry Company is for sale; buying it closes every other private.',
        '7': '4+2 trains rust.',
        '8': '5+3 trains rust. No certificate limit, and share sales no longer move prices.',
        '9': 'The Southern Railway forms: from the next stock round no track is laid, no bases are placed and halts pay nothing. British Rail forms at the end of the first round in which every company with a director has a train.'
    },
    notes: [
        'An M+N train calls at up to M large stations and N small stations or halts; any large-station allowance it leaves unused may serve small stations and halts.',
        'Small stations and halts may be passed by; a halt pays its company £10 for each train calling there.',
        'Trains change hands between companies at any multiple of £10 the directors agree, at least £10.'
    ]
})
