import { MakerTileAppearance } from '../tiles/tileAppearance.js'

export type ColorField<Key extends string = string> = { key: Key; name: string }
export type DisplayChoiceOption = { value: string; name: string }

export const TokenStyleOptions: readonly DisplayChoiceOption[] = [
    { value: 'artwork', name: 'Artwork' },
    { value: 'initials', name: 'Initials' }
]

export const TileStyleOptions: readonly DisplayChoiceOption[] = [
    { value: 'default', name: 'Default' },
    { value: 'maker', name: '18xx Maker' }
]

export const TileColorFields: readonly ColorField[] = [
    { key: 'white', name: 'Map' },
    { key: 'yellow', name: 'Yellow' },
    { key: 'green', name: 'Green' },
    { key: 'brown', name: 'Brown' },
    { key: 'gray', name: 'Gray' },
    { key: 'red', name: 'Off-board' },
    { key: 'blue', name: 'Water' }
]

/** The tile colors a preset's swatch shows. */
export const PresetSwatchColors: readonly string[] = [
    'yellow',
    'green',
    'brown',
    'gray',
    'red',
    'blue'
]

const MakerPresetColors: Readonly<Record<string, string>> = Object.fromEntries(
    TileColorFields.map(({ key }) => [key, MakerTileAppearance.colors[key]])
)

/** A tile color preset over the title's own colors; a preset this version doesn't know is the title's. */
export function tilePresetColors(
    style: string,
    titleColors: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
    return style === 'maker' ? { ...titleColors, ...MakerPresetColors } : titleColors
}

/** Phones show the table in its stacked layout and the Display settings as a modal. */
export const PhoneLayoutQuery = '(width < 40rem)'
