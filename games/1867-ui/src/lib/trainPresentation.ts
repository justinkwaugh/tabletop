const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'

// Each train in the colour of the tiles its phase brings (GTG §11): grey arrives with the 7.
export const TrainColors1867: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    '7': Gray,
    '8': Gray,
    '5+5E': Gray,
    '2+2': Gray
}

export const PhaseColors1867 = TrainColors1867
