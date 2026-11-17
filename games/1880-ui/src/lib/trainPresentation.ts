const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'

// Each train in the colour of the phase letter it belongs to (§XI): A yellow, B green, C brown and
// D grey; the restored 2-train as the 2-train it was.
export const TrainColors1880: Readonly<Record<string, string>> = {
    '2': Yellow,
    '2+2': Yellow,
    '3': Green,
    '3+3': Green,
    '4': Green,
    '4+4': Brown,
    '6': Brown,
    '6E': Brown,
    '8': Gray,
    '8E': Gray,
    '10': Gray,
    '2R': Yellow
}

export const PhaseColors1880: Readonly<Record<string, string>> = {
    A1: Yellow,
    A2: Yellow,
    B1: Green,
    B2: Green,
    B3: Green,
    C1: Brown,
    C2: Brown,
    C3: Brown,
    D1: Gray,
    D2: Gray,
    D3: Gray
}
