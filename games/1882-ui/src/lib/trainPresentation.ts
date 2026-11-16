const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'

// Each train in the colour of the tiles its phase brings (§8); the D-train in grey.
export const TrainColors1882: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    D: Gray
}

export const PhaseColors1882 = TrainColors1882
