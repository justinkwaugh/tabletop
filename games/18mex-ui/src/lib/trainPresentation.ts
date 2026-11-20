import { FourDId, MinorTrainId, SixHalfPhaseId, ThreeHalfPhaseId } from '@tabletop/18mex'

const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#b4b9be'

// Each train in the colour of the tiles its phase brings (Table I).
export const TrainColorsMex: Readonly<Record<string, string>> = {
    '2': Yellow,
    [MinorTrainId]: Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    [FourDId]: Gray
}

export const PhaseColorsMex: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    [ThreeHalfPhaseId]: Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    [SixHalfPhaseId]: Brown,
    [FourDId]: Gray
}
