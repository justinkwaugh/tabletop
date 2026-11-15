import { createPhaseChart } from '@tabletop/18xx-ui'
import { Phases1861, TrainDepot1861, TrainLimits1861 } from '@tabletop/1861'

const limits = (phaseId: string) => {
    const { minor, major } = TrainLimits1861[phaseId] ?? {}
    return [
        ...(minor !== undefined ? [`minors ${minor}`] : []),
        ...(major !== undefined ? [`public companies ${major}`] : [])
    ].join(', ')
}

// The chart's one train limit is a public company's; each phase's notes give both (§8).
const PhaseNotes: Readonly<Record<string, string>> = {
    '2': `Train limit: ${limits('2')}. Red areas pay their first value. Private company hexes are closed to track.`,
    '3': `Train limit: ${limits('3')}. The six later minors may be auctioned; private hexes open; companies may buy players’ privates; minors may convert or merge after each operating round.`,
    '4': `Train limit: ${limits('4')}. Public companies may be started. The Russian State Railway operates. Trainless minors that have operated are nationalised; trainless public companies may be.`,
    '5': `Train limit: ${limits('5')}. No more minors are started. Red areas pay their third value.`,
    '6': `Train limit: ${limits('6')}. Every private is nationalised for its face value. Trainless companies are nationalised as in phase 4. Red areas pay their highest value.`,
    '7': `Train limit: ${limits('7')}.`,
    '8': `Train limit: ${limits('8')}. Every minor is nationalised; the Russian State Railway stops operating. 5+5E- and 2+2-trains on sale. The game ends after the final rounds.`
}

const Notes = [
    'The Russian State Railway has no train limit and operates last in phases 4 to 7.',
    'Merger rounds follow each operating round in phases 3 to 7.'
]

export const PhaseChart1861 = createPhaseChart({
    phases: Phases1861,
    depot: TrainDepot1861,
    phaseNotes: PhaseNotes,
    notes: Notes
})
