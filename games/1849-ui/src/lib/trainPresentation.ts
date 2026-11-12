const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'

// Each train in the colour of the tiles its phase brings (§6).
export const TrainColors1849: Readonly<Record<string, string>> = {
    '4H': Yellow,
    '6H': Green,
    '8H': Green,
    '10H': Brown,
    '12H': Brown,
    '16H': Gray,
    R6H: Gray
}

export const PhaseColors1849 = TrainColors1849
