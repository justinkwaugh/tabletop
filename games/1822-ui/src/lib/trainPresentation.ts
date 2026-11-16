const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Brown = '#bd865e'
const Gray = '#9c9c9c'
const Permanent = '#3f7fb8'

// Each train in the colour of the tiles its phase brings (Table 2); the trains that come with
// private companies stand apart (§5.5.13, §5.5.14).
export const TrainColors1822: Readonly<Record<string, string>> = {
    L: Yellow,
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    '7': Gray,
    E: Gray,
    '2P': Permanent,
    LP: Permanent,
    'P+': Permanent
}

export const PhaseColors1822: Readonly<Record<string, string>> = {
    '1': Yellow,
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Brown,
    '6': Brown,
    '7': Gray
}
