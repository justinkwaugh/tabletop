const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'

// Each train in the colour of the tiles its phase brings (§8).
export const TrainColors1861: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Gray,
    '7': Gray,
    '8': Gray,
    '5+5E': Gray,
    '2+2': Gray
}

export const PhaseColors1861 = TrainColors1861
