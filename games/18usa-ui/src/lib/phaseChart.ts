import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    EighteenUSAPhases,
    EighteenUSATrainDepot,
    PullmanScrapValue,
    PullmanStopBonus,
    PullmanTrainId,
    eighteenUSAOptions,
    type EighteenUSAState
} from '@tabletop/18usa'

const Obsolete = 'Obsolete when its rusting train arrives: runs once more, then is removed.'
const Pullman = `Pullman: rides with one train a run, +$${PullmanStopBonus} at every city and red area it visits; scrapped for $${PullmanScrapValue}. On sale from phase 5.`

const PhaseNotes: Readonly<Record<string, string>> = {
    '2': 'Companies start with 2 shares.',
    '3': 'Companies start with 2 or 5 shares. Begins after the second operating round at the latest.',
    '4': 'Companies start with 5 shares.',
    '5': 'Companies start with 5 or 10 shares. Pullmans for sale; oil tokens and +10/+20 bonuses pay $20; new city hexes take green tiles, and plain track may skip colours for $10 a level.',
    '6': 'Companies start with 10 shares. American Locomotive (P25) closes when a company buys the first 6-train.',
    '7': 'Companies start with 10 shares.',
    '8': 'Companies start with 10 shares. No new shorts. The game ends three operating rounds later.'
}

const Notes = [
    'Companies are started by auction from $100 in $1 steps; a city’s cash subsidy counts toward the winning bid.',
    'A second tile action in a turn costs $20; only one of the two may be an upgrade.'
]

const chart = (seventeenTrains: boolean): PhaseChartData =>
    createPhaseChart({
        phases: EighteenUSAPhases,
        depot: EighteenUSATrainDepot,
        rustNotes: { '2+': Obsolete, '3+': Obsolete, '4+': Obsolete, [PullmanTrainId]: Pullman },
        omittedTrainIds: seventeenTrains ? ['3+', '4+'] : [],
        phaseNotes: PhaseNotes,
        notes: Notes
    })

export const EighteenUSAPhaseChart = chart(false)
const SeventeenTrainsPhaseChart = chart(true)

export function eighteenUSAPhaseChart(state: EighteenUSAState): PhaseChartData {
    return eighteenUSAOptions(state).seventeenTrains
        ? SeventeenTrainsPhaseChart
        : EighteenUSAPhaseChart
}
