import { CobourgTrainId, DieselTrainId } from '@tabletop/1828'

const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Blue = '#5b8fd6'
const Brown = '#bd865e'
const Red = '#d9534f'
const Gray = '#9a9a9a'
const Purple = '#9b59b6'

// Each phase takes the colour the rules name it by, and each train the colour of the phase it
// starts (§17).
export const PhaseColors1828: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '5': Blue,
    '3+D': Brown,
    '6': Red,
    '8E': Gray,
    [DieselTrainId]: Purple
}

export const TrainColors1828: Readonly<Record<string, string>> = {
    ...PhaseColors1828,
    [CobourgTrainId]: Yellow
}
