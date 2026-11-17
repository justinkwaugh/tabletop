import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import { Phases1880, TrainDepot1880 } from '@tabletop/1880'

// The phase chart's further information (§XI).
const PhaseNotes: Readonly<Record<string, string>> = {
    A1: 'Directors float with 20%. Companies receive half their capital; five shares each are on sale. One yellow tile a turn, two for the BCR.',
    B1: 'Directors float with 30%. All ten shares on sale; companies with five sold receive the second half of their capital. Green tiles; two yellow tiles a turn. Trains may be bought from a company with the same director.',
    B3: 'Communist Takeover: no share price moves, no director sells their own company, privates pay nothing, foreign investors stop. Directors float with 40%. The Rocket of China is exchanged for the second 4-train.',
    C1: 'Brown tiles.',
    C2: 'The Shanghai Stock Exchange re-opens: prices move and directors sell again. Directors float with 60%. Restored 2-trains on sale for ¥250.',
    D1: 'Grey tiles. Station markers cost twice as much. The second 8-train brings the last share round; every company then operates three more times.'
}

const Notes = [
    'The last train of a kind leaving the bank brings a share round in the middle of the operating round; the company resumes buying trains after it.',
    'If a whole round passes with no new train bought, the trains on sale leave the game when the train-marker company finishes buying.',
    'Trains over the limit leave the game.'
]

export const PhaseChart1880: PhaseChartData = createPhaseChart({
    phases: Phases1880,
    depot: TrainDepot1880,
    rustNotes: {},
    phaseNotes: PhaseNotes,
    notes: Notes,
    // Operating rounds follow one another endlessly, share rounds breaking in (§IX).
    operatingRoundsHidden: true
})
