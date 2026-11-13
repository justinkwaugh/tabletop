import { createPhaseChart } from '@tabletop/18xx-ui'
import { ElectricTrainId, Phases1849, TrainDepot1849 } from '@tabletop/1849'

const phaseNotes = {
    '4H': 'Corporations start at L. 68 or L. 100. Grey cities pay their lowest value.',
    '6H': 'Corporations may buy players’ privates for L. 1 to twice face value, and start at L. 144.',
    '8H': 'Grey cities pay their middle value.',
    '10H': 'Corporations may start at L. 216.',
    '12H': 'Privates close. The Messina earthquake. Grey cities pay their highest value.',
    '16H': 'R6H trains go on sale. Share prices may enter the blue zone.'
}

// What each phase changes (§6, §7.1, §9.4, §10.5.2, §12); the E trains only with Electric Dreams.
export const PhaseChart1849 = createPhaseChart({
    phases: Phases1849,
    depot: TrainDepot1849,
    phaseNotes,
    omittedTrainIds: [ElectricTrainId]
})

/** With Electric Dreams: E tokens and trains from the first 12H (§14.3). */
export const ElectricPhaseChart1849 = createPhaseChart({
    phases: Phases1849,
    depot: TrainDepot1849,
    phaseNotes: {
        ...phaseNotes,
        '12H': `${phaseNotes['12H']} E tokens and E trains go on sale.`
    },
    permanentTrainIds: [ElectricTrainId],
    notes: [
        'E trains run any distance off narrow gauge and double Catania, Messina, Palermo and Siracusa; a corporation needs an E token to buy them.'
    ]
})
