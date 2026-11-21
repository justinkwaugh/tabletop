import { PullmanTrainId } from '@tabletop/18usa'

const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#a3a3a3'

// Each train in the colour of the tiles its phase brings (§8); the Pullman, which rides with
// another train, in its own dark coach colour.
export const EighteenUSATrainColors: Readonly<Record<string, string>> = {
    '2': Yellow,
    '2+': Yellow,
    '3': Green,
    '3+': Green,
    '4': Green,
    '4+': Green,
    '5': Brown,
    '6': Brown,
    '7': Gray,
    '8': Gray,
    [PullmanTrainId]: '#4f6d7a'
}

export const EighteenUSAPhaseColors: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    '7': Gray,
    '8': Gray
}
