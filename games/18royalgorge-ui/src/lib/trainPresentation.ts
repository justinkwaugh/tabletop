import {
    BrownFivePhaseId,
    BrownPhaseId,
    FivePlusId,
    FourPlusId,
    GreenFourPhaseId,
    GreenPhaseId,
    SilverPhaseId,
    SilverSixPhaseId,
    SixByTwoId,
    ThreePlusId,
    TreatyPhaseId,
    TwoPlusId,
    YellowPhaseId
} from '@tabletop/18royalgorge'

const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Silver = '#b4b9be'

// Each train in the colour of the phase it brings: the 4+ ends Green, the 5+ Brown (phase cards).
export const TrainColorsRoyalGorge: Readonly<Record<string, string>> = {
    [TwoPlusId]: Yellow,
    [ThreePlusId]: Green,
    [FourPlusId]: Green,
    [FivePlusId]: Brown,
    [SixByTwoId]: Silver
}

export const PhaseColorsRoyalGorge: Readonly<Record<string, string>> = {
    [YellowPhaseId]: Yellow,
    [GreenPhaseId]: Green,
    [TreatyPhaseId]: Green,
    [GreenFourPhaseId]: Green,
    [BrownPhaseId]: Brown,
    [BrownFivePhaseId]: Brown,
    [SilverPhaseId]: Silver,
    [SilverSixPhaseId]: Silver
}
