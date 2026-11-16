import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    ElectricTrainId,
    MinorTrainLimits1822,
    PermanentLocalTrainId,
    PermanentTwoTrainId,
    Phases1822,
    PullmanTrainId,
    TrainDepot1822
} from '@tabletop/1822'

// What each phase brings (§2.2, §2.3, Table 2).
const PhaseNotes: Readonly<Record<string, string>> = {
    '1': 'Only minor companies run, each laying one yellow tile; a minor bought now starts at £50 with £100. Trains come from the bank only.',
    '2': 'Concessions may be converted, starting their major companies, which lay one yellow tile and may acquire minor companies. A minor bought now starts with twice its value.',
    '3': 'L trains rust. Companies may buy trains from one another. Majors lay two yellow tiles or one upgrade; minors one yellow or one green. A minor bought now starts with the sum bid. Grey areas pay their green value.',
    '4': '2-trains rust.',
    '5': 'Concessions leave play: a director’s certificate is bought outright and its company floats once half is sold. Majors may acquire minors from the bidding boxes for £200. Grey areas pay their brown value.',
    '6': '3-trains rust. A company floating now is paid for all ten shares, the unsold half going to the bank pool.',
    '7': '4-trains rust. Grey areas pay their grey value.'
}

const chart = createPhaseChart({
    phases: Phases1822,
    depot: TrainDepot1822,
    permanentTrainIds: [PermanentTwoTrainId, PermanentLocalTrainId, PullmanTrainId],
    rustNotes: {
        L: 'One station',
        [ElectricTrainId]: 'Own stations ×2'
    },
    notes: [
        'The bank sells the next train in order; an L/2 and a 7/E are two sides of one card.',
        'An L-train runs at one of its company’s stations, and may run on to one small station. In phases 1 and 2 it is flipped to a 2-train for £80.',
        'An E-train stops only at its company’s stations, each counting double, and runs on track other trains use. One to a company.',
        'A minor company keeps half of what it earns; a major company pays all, half or none.',
        'A company without a train must buy one, its director making up the price and borrowing at 50% interest if they must.'
    ]
})

export const PhaseChart1822: PhaseChartData = {
    ...chart,
    phases: chart.phases.map((phase) => {
        const minor = MinorTrainLimits1822[phase.id]
        const limits =
            phase.id === '1'
                ? `Train limit: minors ${minor}.`
                : `Train limit: majors ${phase.trainLimit}, minors ${minor}.`
        return { ...phase, notes: `${limits} ${PhaseNotes[phase.id] ?? ''}`.trim() }
    })
}
