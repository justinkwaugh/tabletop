import { createPhaseChart } from '@tabletop/18xx-ui'
import { Phases1833NE, TrainDepot1833NE } from '@tabletop/1833ne'

const phaseOut = (trains: string, phase: string, removal: string) =>
    `${trains} trains are phased out in phase ${phase}: they run once more and leave, and any left are removed in phase ${removal}.`

export const PhaseChart1833NE = createPhaseChart({
    phases: Phases1833NE,
    depot: TrainDepot1833NE,
    rustPhases: { '2': 'III', '2+1': 'III', '3/5': 'IV', '2+2': 'IV', '4/7': 'V', '3+3': 'V' },
    rustNotes: {
        '2': phaseOut('2 and 2+1', 'III', 'IV'),
        '2+1': phaseOut('2 and 2+1', 'III', 'IV'),
        '3/5': phaseOut('3/5 and 2+2', 'IV', 'V'),
        '2+2': phaseOut('3/5 and 2+2', 'IV', 'V'),
        '4/7': '4/7 and 3+3 trains are phased out in phase V: they run once more and leave.',
        '3+3': '4/7 and 3+3 trains are phased out in phase V: they run once more and leave.'
    },
    phaseNotes: {
        I: 'Off-board and bonus values I–II. Corporations may buy privates and each other’s trains.',
        III: 'Privates still with players and P1–P2 are removed; corporation-owned privates stop paying. Off-board and bonus values III–IV.',
        IV: 'P3–P5, every ferry and the reserved spots in Worcester and Boston are removed.',
        V: 'Off-board and bonus values V.'
    },
    notes: [
        'Before phase V each certificate has two sides: 2 or 2+1, 3/5 or 2+2, 4/7 or 3+3, 6/9 or 5+3.',
        'An N/M train counts N of the M stops it visits, one of them its token. An N+s train visits N stops and up to s more small cities.'
    ]
})
