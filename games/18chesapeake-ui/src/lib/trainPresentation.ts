const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'

// Each train in the colour of the tiles its phase brings (§8).
export const TrainColorsChesapeake: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    D: Gray
}

export const PhaseColorsChesapeake = TrainColorsChesapeake
