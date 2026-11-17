import { createPhaseChart } from '@tabletop/18xx-ui'
import { Phases1867, TrainDepot1867, TrainLimits1867 } from '@tabletop/1867'

const limits = (phaseId: string) => {
    const { minor, major } = TrainLimits1867[phaseId] ?? {}
    return [
        ...(minor !== undefined ? [`minors ${minor}`] : []),
        ...(major !== undefined ? [`majors ${major}`] : [])
    ].join(', ')
}

// The chart's one train limit is a major's; each phase's notes give both (GTG §11).
const PhaseNotes: Readonly<Record<string, string>> = {
    '2': `Train limit: ${limits('2')}. Off-boards pay their first value. Locked hexes are closed to track; the green city spaces of Montreal and Timmins take no station.`,
    '3': `Train limit: ${limits('3')}. The six green minors may be auctioned; locked hexes and green city spaces open; companies may buy players’ privates; minors may convert or merge after each operating round.`,
    '4': `Train limit: ${limits('4')}. Majors may be started. The Canadian National exports a train after every operating round. Trainless minors that have operated are nationalised; trainless majors may be.`,
    '5': `Train limit: ${limits('5')}. No more minors are started. Off-boards pay their third value.`,
    '6': `Train limit: ${limits('6')}. Every private is nationalised for its face value. Trainless companies are nationalised as in phase 4.`,
    '7': `Train limit: ${limits('7')}. Grey tiles. Off-boards pay their highest value.`,
    '8': `Train limit: ${limits('8')}. Every minor is nationalised; the Canadian National stops exporting and places its Montreal station. 5+5E- and 2+2-trains on sale; majors may trade a train in for half its value. The game ends after the final rounds.`
}

const Notes = [
    'The Canadian National never operates: from phase 4 to 7 it exports the next train after every operating round.',
    'Merger rounds follow each operating round in phases 3 to 7.'
]

export const PhaseChart1867 = createPhaseChart({
    phases: Phases1867,
    depot: TrainDepot1867,
    phaseNotes: PhaseNotes,
    notes: Notes
})
