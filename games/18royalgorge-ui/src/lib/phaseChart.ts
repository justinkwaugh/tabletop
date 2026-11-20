import { createPhaseChart, type PhaseChartData } from '@tabletop/18xx-ui'
import {
    BrownFivePhaseId,
    BrownPhaseId,
    GreenFourPhaseId,
    GreenPhaseId,
    PhasesRoyalGorge,
    SilverPhaseId,
    SilverSixPhaseId,
    TrainDepotRoyalGorge,
    TreatyPhaseId,
    YellowPhaseId
} from '@tabletop/18royalgorge'

// The rulebook's phases are colours; the deck's other cards start events within a colour.
export const PhaseChartRoyalGorge: PhaseChartData = createPhaseChart({
    phases: PhasesRoyalGorge,
    depot: TrainDepotRoyalGorge,
    phaseNames: {
        [YellowPhaseId]: 'Yellow',
        [GreenPhaseId]: 'Green',
        [TreatyPhaseId]: 'Green',
        [GreenFourPhaseId]: 'Green',
        [BrownPhaseId]: 'Brown',
        [BrownFivePhaseId]: 'Brown',
        [SilverPhaseId]: 'Silver',
        [SilverSixPhaseId]: 'Silver'
    },
    phaseEvents: {
        [TreatyPhaseId]: 'Treaty of Boston',
        [GreenFourPhaseId]: '2+ rust',
        [BrownFivePhaseId]: 'privates close',
        [SilverSixPhaseId]: '3+ rust'
    },
    phaseNotes: {
        [YellowPhaseId]:
            'Yellow steel and pars. The first two railroads by year may start. Up to 2 gold shipments a set.',
        [GreenPhaseId]:
            'Starts as the last 2+ leaves. Green steel and pars; the next two railroads may start; railroads may buy players’ privates. Up to 4 gold shipments a set.',
        [TreatyPhaseId]:
            'Starts as the second 3+ leaves. The green gorge is laid with two Rio Grande stations; RG owes SF 4 debts and SF owes Doc Holliday 2. The debt marker moves each operating round.',
        [GreenFourPhaseId]: '2+ trains rust, paying their railroad $20.',
        [BrownPhaseId]:
            'Starts as the last 4+ leaves. Brown steel and pars; the last railroad may start. Up to 5 gold shipments a set. The St. Cloud Hotel moves to Cañon City.',
        [BrownFivePhaseId]: 'Privates close, but those whose cards say otherwise.',
        [SilverPhaseId]:
            'Starts as the last 5+ leaves. Gray tiles, whose steel is $40. Railroads no longer buy privates.',
        [SilverSixPhaseId]:
            '3+ trains rust, paying their railroad $45. The game ends after one more stock round and set.'
    },
    notes: [
        'A train leaves the depot after every set: all the 2+ trains first, then one train a set.',
        'A purchase that rusts one of its railroad’s own trains may exceed the train limit.'
    ]
})
