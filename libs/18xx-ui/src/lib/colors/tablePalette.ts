import type { EighteenXXDisplayPreferences } from '@tabletop/18xx'
import { contrastingTextColor } from './contrastingTextColor.js'
import { mixHex, relativeLuminance } from './hexColor.js'
import type { ColorField, DisplayChoiceOption } from '../table/displayChoices.js'

export type TableColorChoice = EighteenXXDisplayPreferences['tableColors']
export type TableColorKey = keyof TableColorChoice
export type TableColorField = ColorField<TableColorKey>

export const TableStyleOptions: readonly DisplayChoiceOption[] = [
    { value: 'default', name: 'Default' },
    { value: 'light', name: 'Light' },
    { value: 'contrast', name: 'High contrast' }
]

/** The table's ``--rail-*`` colors, without the prefix. */
export type TablePalette = Readonly<Record<string, string>>

/** The palette color each pick sets, and the one it shows where the palette leaves it unset. */
const TableColorRoles: Readonly<Record<TableColorKey, { role: string; fallback?: string }>> = {
    background: { role: 'table-background' },
    surface: { role: 'surface' },
    text: { role: 'text' },
    header: { role: 'surface-raised' },
    border: { role: 'border' },
    paneBorder: { role: 'pane-border', fallback: 'border' },
    muted: { role: 'muted' },
    inactive: { role: 'tab-inactive', fallback: 'inactive' },
    focus: { role: 'focus' },
    negative: { role: 'negative' },
    market: { role: 'market' },
    soldOut: { role: 'sold-out' },
    unfloated: { role: 'unfloated' },
    soldThisRound: { role: 'sold-this-round' },
    sheetBorder: { role: 'sheet-divider' }
}

function isTableColorKey(key: string): key is TableColorKey {
    return Object.hasOwn(TableColorRoles, key)
}

export const TableColorFields: readonly TableColorField[] = [
    { key: 'background', name: 'Background' },
    { key: 'surface', name: 'Panels' },
    { key: 'text', name: 'Text' }
]
export const MoreTableColorFields: readonly TableColorField[] = [
    { key: 'header', name: 'Headers & popups' },
    { key: 'border', name: 'Card borders' },
    { key: 'paneBorder', name: 'Pane borders' },
    { key: 'sheetBorder', name: 'Spreadsheet borders' },
    { key: 'muted', name: 'Labels' },
    { key: 'inactive', name: 'Inactive tabs' },
    { key: 'focus', name: 'Highlight' },
    { key: 'negative', name: 'Negative' },
    { key: 'market', name: 'Market value' },
    { key: 'soldOut', name: 'Sold out' },
    { key: 'unfloated', name: 'Unfloated' },
    { key: 'soldThisRound', name: 'Sold this round' }
]

const DefaultPalette: TablePalette = {
    text: '#e3e9ef',
    negative: '#ff9c91',
    warning: '#f2b84b',
    muted: '#7f8e9e',
    inactive: '#596777',
    surface: '#222c37',
    'surface-inset': '#1b232d',
    'surface-raised': '#2b3744',
    'surface-selected': '#3a4c5e',
    solid: '#40576b',
    border: '#485666',
    'interstitial-border': '#18212b',
    focus: '#b8cddd',
    hover: '#b8cddd18',
    shadow: '#00000055',
    backdrop: '#080f18bb',
    'table-background': '#18212b',
    market: '#1f343d',
    'sold-out': '#f1e6c8',
    unfloated: '#e2a84f',
    'sold-this-round': '#4a2a33',
    'sheet-divider': '#5b6d80',
    'sheet-rule': '#2f3b48'
}

/**
 * The published board's own palette: bright text is its light tan paper, dimmed text the
 * grey-tan of its stock market figures, and surfaces its slate market cells on the near-black
 * slate ground (MAP-JUNE-for-print: ground #1a292c, cells #213742, figures #b2a994). Its tabs
 * read in the dimmed-text color, like the game information labels.
 */
const PublishedPalette: TablePalette = {
    ...DefaultPalette,
    text: '#e6dbce',
    muted: '#a8a094',
    inactive: '#7a746a',
    'tab-inactive': '#a8a094',
    border: '#34474f',
    solid: '#2c4652',
    'interstitial-border': '#1a292c',
    surface: '#213742',
    'surface-inset': '#182427',
    'surface-raised': '#29434f',
    'surface-selected': '#34505e',
    hover: '#e6dbce18',
    focus: '#e6dbce',
    'table-background': '#1a292c'
}

const LightPalette: TablePalette = {
    text: '#27313b',
    negative: '#b3261e',
    warning: '#8a5a00',
    muted: '#2f3132',
    inactive: '#bbbdbf',
    surface: '#ffffff',
    'surface-inset': '#f6f6f6',
    'surface-raised': '#ebebeb',
    'surface-selected': '#d4d6d8',
    solid: '#c9ccce',
    'solid-text': '#27313b',
    border: '#7a7a7a',
    'pane-border': '#cccccc',
    'interstitial-border': '#ededed',
    focus: '#525a62',
    hover: '#27313b17',
    shadow: '#0000002e',
    backdrop: '#edededbf',
    'table-background': '#ededed',
    market: '#e0edee',
    'sold-out': '#5a4a2a',
    unfloated: '#9a5b00',
    'sold-this-round': '#f0d3d8',
    'sheet-divider': '#7a7a7a',
    'sheet-rule': '#d9d9d9'
}

const ContrastPalette: TablePalette = {
    text: '#ffffff',
    negative: '#ff8a80',
    warning: '#ffd54f',
    muted: '#d0d0d0',
    inactive: '#a0a0a0',
    surface: '#0d0d0d',
    'surface-inset': '#000000',
    'surface-raised': '#1f1f1f',
    'surface-selected': '#3a3a3a',
    solid: '#4a4a4a',
    'solid-text': '#ffffff',
    border: '#9a9a9a',
    'interstitial-border': '#000000',
    focus: '#ffe14d',
    hover: '#ffffff26',
    shadow: '#000000aa',
    backdrop: '#000000cc',
    'table-background': '#000000',
    market: '#0e282d',
    'sold-out': '#ffffff',
    unfloated: '#ffb74d',
    'sold-this-round': '#5c1a2a',
    'sheet-divider': '#9a9a9a',
    'sheet-rule': '#3a3a3a'
}

type MainColors = { background: string; surface: string; text: string }
type MainColor = keyof MainColors
type Derivation = {
    from: readonly MainColor[]
    color: (colors: MainColors, light: boolean) => string
}

const MainColorKeys: readonly MainColor[] = ['background', 'surface', 'text']

const isLight = (surface: string) => relativeLuminance(surface) > 0.4

const fromTextOnSurface = (percent: number): Derivation => ({
    from: ['text', 'surface'],
    color: ({ text, surface }) => mixHex(text, surface, percent)
})
const fromSurfaceToText = (percent: number): Derivation => ({
    from: ['text', 'surface'],
    color: ({ text, surface }) => mixHex(surface, text, percent)
})
const bySurfaceShade = (light: string, dark: string): Derivation => ({
    from: ['surface'],
    color: (_, isLightSurface) => (isLightSurface ? light : dark)
})

/** How each palette color follows from the main three, and which of them it follows. */
const Derivations: Readonly<Record<string, Derivation>> = {
    text: { from: ['text'], color: ({ text }) => text },
    surface: { from: ['surface'], color: ({ surface }) => surface },
    'table-background': { from: ['background'], color: ({ background }) => background },
    'interstitial-border': { from: ['background'], color: ({ background }) => background },
    backdrop: { from: ['background'], color: ({ background }) => `${background}bf` },
    'surface-inset': {
        from: ['surface', 'background'],
        color: ({ surface, background }) => mixHex(surface, background, 50)
    },
    muted: fromTextOnSurface(55),
    inactive: fromTextOnSurface(35),
    focus: fromTextOnSurface(80),
    'sheet-divider': fromTextOnSurface(33),
    'sheet-rule': fromTextOnSurface(10),
    'surface-raised': fromSurfaceToText(93),
    'surface-selected': fromSurfaceToText(80),
    solid: fromSurfaceToText(75),
    border: fromSurfaceToText(75),
    'pane-border': fromSurfaceToText(75),
    'solid-text': {
        from: ['text', 'surface'],
        color: ({ text, surface }) => contrastingTextColor(mixHex(surface, text, 75))
    },
    hover: { from: ['text'], color: ({ text }) => `${text}17` },
    negative: bySurfaceShade('#b3261e', '#ff9c91'),
    warning: bySurfaceShade('#8a5a00', '#f2b84b'),
    shadow: bySurfaceShade('#0000002e', '#00000055'),
    'sold-out': bySurfaceShade('#5a4a2a', '#f1e6c8'),
    unfloated: bySurfaceShade('#9a5b00', '#e2a84f'),
    'sold-this-round': bySurfaceShade('#f0d3d8', '#4a2a33'),
    market: {
        from: ['surface'],
        color: ({ surface }, light) => mixHex(light ? '#b9d6da' : '#1b3d45', surface, 45)
    }
}

export type TablePresentation = { palette: TablePalette; scheme: 'light' | 'dark' }

/** The published-artwork presentation, with its board's ground where the board sets one. */
export type PublishedTable = { background?: string }

/** A preset this version doesn't know draws as the default. */
function presetPalette(style: string, published: PublishedTable | undefined): TablePalette {
    if (style === 'light') return LightPalette
    if (style === 'contrast') return ContrastPalette
    if (!published) return DefaultPalette
    return published.background
        ? { ...PublishedPalette, 'table-background': published.background }
        : PublishedPalette
}

/**
 * The table's colors for a player's preset and picks. A pick of the background, panels or text
 * redraws only the colors that follow from it, keeping the preset's others; any other pick sets
 * just its own color, the spreadsheet border taking its fainter row lines with it.
 */
export function tablePresentation(
    style: string,
    choice: TableColorChoice,
    published?: PublishedTable
): TablePresentation {
    const preset = presetPalette(style, published)
    const main: MainColors = {
        background: choice.background ?? preset['table-background'],
        surface: choice.surface ?? preset.surface,
        text: choice.text ?? preset.text
    }
    const picked = MainColorKeys.filter((key) => choice[key])
    const light = isLight(main.surface)
    const derived = Object.entries(Derivations).flatMap(([role, derivation]) =>
        derivation.from.some((key) => picked.includes(key))
            ? [[role, derivation.color(main, light)]]
            : []
    )
    const picks = Object.entries(choice).flatMap(([key, color]) =>
        isTableColorKey(key) && color ? [[TableColorRoles[key].role, color]] : []
    )
    const sheetRule = choice.sheetBorder
        ? [['sheet-rule', mixHex(choice.sheetBorder, main.surface, 23)]]
        : []
    const palette: TablePalette = {
        ...preset,
        ...Object.fromEntries(derived),
        ...Object.fromEntries(picks),
        ...Object.fromEntries(sheetRule)
    }
    return { palette, scheme: isLight(palette.surface) ? 'light' : 'dark' }
}

/** The color a picker shows for its role in a palette. */
export function tableColor(palette: TablePalette, key: TableColorKey): string {
    const { role, fallback } = TableColorRoles[key]
    return palette[role] ?? palette[fallback ?? role]
}

/** The palette as ``--rail-*`` custom properties. */
export function tablePaletteVariables(palette: TablePalette): Readonly<Record<string, string>> {
    return Object.fromEntries(
        Object.entries(palette).map(([name, value]) => [`--rail-${name}`, value])
    )
}

/** Custom properties as an inline style. */
export function inlineVariables(variables: Readonly<Record<string, string>>): string | undefined {
    const entries = Object.entries(variables)
    return entries.length
        ? entries.map(([name, value]) => `${name}: ${value}`).join('; ')
        : undefined
}
