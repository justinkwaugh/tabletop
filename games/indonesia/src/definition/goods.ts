export enum Good {
    Rice = 'Rice',
    Spice = 'Spice',
    Rubber = 'Rubber',
    Oil = 'Oil',
    SiapSaji = 'SiapSaji'
}

export function isGood(value: unknown): value is Good {
    return (
        value === Good.Rice ||
        value === Good.Spice ||
        value === Good.Rubber ||
        value === Good.Oil ||
        value === Good.SiapSaji
    )
}
