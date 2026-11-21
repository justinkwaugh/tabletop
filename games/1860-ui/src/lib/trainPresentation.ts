const Yellow = '#ffdf00'
const Green = '#5ab67e'
const Russet = '#b9764f'

// Each train in the colour of the tiles its phase brings (Phases): yellow, green, then russet.
export const TrainColors1860: Readonly<Record<string, string>> = {
    '2+1': Yellow,
    '3+2': Green,
    '4+2': Green,
    '5+3': Russet,
    '6+3': Russet,
    '7+4': Russet,
    '8+4': Russet,
    '9+5': Russet
}

export const PhaseColors1860: Readonly<Record<string, string>> = {
    '2': Yellow,
    '3': Green,
    '4': Green,
    '5': Russet,
    '6': Russet,
    '7': Russet,
    '8': Russet,
    '9': Russet
}
