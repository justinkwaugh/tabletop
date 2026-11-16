import type { AxialCoordinates } from '@tabletop/common'
import { CompanyId, EditionId, HexKind, printedHex, printedPointyHex } from '@tabletop/railheads'
import {
    DANISH_HEX_FILL,
    ENGLISH_HEX_FILL,
    HEX_FILL,
    MIDWEST_HEX_FILL,
    SWISS_HEX_FILL
} from './companyStyle.js'

export enum Flag {
    Germany = 'Germany',
    UnitedStates = 'UnitedStates',
    Switzerland = 'Switzerland',
    Denmark = 'Denmark',
    UnitedKingdom = 'UnitedKingdom'
}

export type LakeLabel = { name: string; at: AxialCoordinates; angle: number }

export type EditionStyle = {
    title: string
    flag: Flag
    titleStroke: string
    hexFill: Readonly<Record<HexKind, string>>
    // Countryside fill per region, so neighbouring regions read apart.
    regionFill: Readonly<Record<string, string>>
    hexEdgeWidth: number
    endBonusName: string
    endBonusShort: string
    endBonusRule: string
    industryBonusName: string
    industryBonusShort: string
    shareIconCompanies: readonly CompanyId[]
    trackIconCompanies: readonly [CompanyId, CompanyId]
    lakeLabels: readonly LakeLabel[]
    regionLabels: Readonly<Record<string, AxialCoordinates>>
    // Regions that only tag Industry Sites (Switzerland's neighbours) are named, not bordered.
    regionBorders: boolean
    // The map's surroundings: Denmark sits in the sea.
    background?: string
}

// Four beige shades; no two neighbouring Midwest states share one.
const STATE_FILL = {
    Sand: '#e2d5ab',
    Tan: '#c6ad7c',
    Wheat: '#d9c189',
    Khaki: '#bfb999'
}

const EDITION_STYLES: Record<EditionId, EditionStyle> = {
    [EditionId.Germany]: {
        title: 'Germany',
        flag: Flag.Germany,
        titleStroke: '#3c5816',
        hexFill: HEX_FILL,
        regionFill: {},
        hexEdgeWidth: 2.5,
        endBonusName: 'Railroad Bonus',
        endBonusShort: 'Railroad',
        endBonusRule:
            'at every city, town or industry site where this railroad has the top disc, $1 a share for each disc beneath it',
        industryBonusName: 'Industry Bonus',
        industryBonusShort: 'Industry',
        shareIconCompanies: [CompanyId.KPEV, CompanyId.KSSE, CompanyId.GBSE],
        trackIconCompanies: [CompanyId.GBSE, CompanyId.KBSB],
        lakeLabels: [],
        regionLabels: {},
        regionBorders: true
    },
    [EditionId.Midwest]: {
        title: 'The Midwest',
        flag: Flag.UnitedStates,
        titleStroke: '#2f6ea5',
        hexFill: MIDWEST_HEX_FILL,
        regionFill: {
            ND: STATE_FILL.Sand,
            NE: STATE_FILL.Sand,
            WI: STATE_FILL.Sand,
            IN: STATE_FILL.Sand,
            SD: STATE_FILL.Tan,
            KS: STATE_FILL.Tan,
            IL: STATE_FILL.Tan,
            MN: STATE_FILL.Wheat,
            MO: STATE_FILL.Wheat,
            MI: STATE_FILL.Wheat,
            IA: STATE_FILL.Khaki,
            OH: STATE_FILL.Khaki
        },
        hexEdgeWidth: 1.5,
        endBonusName: 'State Subsidies',
        endBonusShort: 'Subsidies',
        endBonusRule:
            'a share earns the State Subsidies table’s amount for the number of states holding this railroad’s track',
        industryBonusName: 'Establishment Bonus',
        industryBonusShort: 'Establishment',
        shareIconCompanies: [CompanyId.NYC, CompanyId.IC, CompanyId.PRR],
        trackIconCompanies: [CompanyId.PRR, CompanyId.BO],
        lakeLabels: [
            { name: 'Lake Superior', at: printedPointyHex(0, 22), angle: 0 },
            { name: 'Lake Superior', at: printedPointyHex(0, 30), angle: 0 },
            { name: 'Lake Michigan', at: printedPointyHex(4.5, 28.5), angle: -72 },
            { name: 'Lake Huron', at: printedPointyHex(5, 36), angle: 0 },
            { name: 'Lake Erie', at: printedPointyHex(8, 37), angle: 0 }
        ],
        regionLabels: {
            ND: printedPointyHex(0.5, 6),
            SD: printedPointyHex(3, 6.5),
            NE: printedPointyHex(8.5, 9.5),
            KS: printedPointyHex(12, 11),
            MN: printedPointyHex(4, 14),
            IA: printedPointyHex(7.5, 16),
            MO: printedPointyHex(11, 16),
            WI: printedPointyHex(4.5, 23),
            IL: printedPointyHex(9.5, 25),
            MI: printedPointyHex(6.5, 34),
            IN: printedPointyHex(11, 30),
            OH: printedPointyHex(10, 36)
        },
        regionBorders: true
    },
    [EditionId.Switzerland]: {
        title: 'Switzerland',
        flag: Flag.Switzerland,
        titleStroke: '#b8232a',
        hexFill: SWISS_HEX_FILL,
        regionFill: {},
        hexEdgeWidth: 2,
        endBonusName: 'Total Subsidies',
        endBonusShort: 'Subsidies',
        endBonusRule:
            'a share earns the French, German and Austrian subsidies for the flagged sites this railroad reaches, times the Italian factor; nothing above its Loan Limit',
        industryBonusName: 'Establishment Bonus',
        industryBonusShort: 'Establishment',
        shareIconCompanies: [CompanyId.SNB, CompanyId.PB, CompanyId.MOB],
        trackIconCompanies: [CompanyId.MOB, CompanyId.AB],
        lakeLabels: [
            { name: 'Lake Zurich', at: printedPointyHex(5, 28), angle: 0 },
            { name: 'Lake Lucerne', at: printedPointyHex(7, 27), angle: 0 },
            { name: 'Obersee', at: printedPointyHex(2.5, 36.5), angle: 60 },
            { name: 'Lake Neuchâtel', at: printedPointyHex(8.5, 9.5), angle: -60 },
            { name: 'Lake Geneva', at: printedPointyHex(12, 7), angle: 0 }
        ],
        regionLabels: {
            France: printedPointyHex(6, 4),
            Germany: printedPointyHex(1, 21),
            Austria: printedPointyHex(5, 43),
            Italy: printedPointyHex(16, 24)
        },
        regionBorders: false
    },
    [EditionId.Denmark]: {
        title: 'Denmark',
        flag: Flag.Denmark,
        titleStroke: '#b8232a',
        hexFill: DANISH_HEX_FILL,
        regionFill: {},
        hexEdgeWidth: 2,
        endBonusName: 'Bond Redemption',
        endBonusShort: 'Bonds',
        endBonusRule: 'each Government Bond pays the State Treasury divided by the bonds held',
        industryBonusName: 'Establishment Bonus',
        industryBonusShort: 'Establishment',
        shareIconCompanies: [CompanyId.DSJ, CompanyId.AHB, CompanyId.SFJ],
        trackIconCompanies: [CompanyId.SFJ, CompanyId.AAAJ],
        lakeLabels: [],
        regionLabels: {},
        regionBorders: false,
        background: '#cfe3ec'
    },
    [EditionId.EnglandWales]: {
        title: 'England & Wales',
        flag: Flag.UnitedKingdom,
        titleStroke: '#1f4f9e',
        hexFill: ENGLISH_HEX_FILL,
        // Each designated region tinted after its railway's colour.
        regionFill: {
            Midlands: '#d9b8b4',
            East: '#b3cde6',
            West: '#e3dcae',
            South: '#b9d6ae'
        },
        hexEdgeWidth: 2,
        endBonusName: 'Running Rights Bonus',
        endBonusShort: 'Running Rights',
        endBonusRule:
            'a share earns $1 for each town, city and site this railroad reaches outside its designated region, London excepted',
        industryBonusName: 'Establishment Bonus',
        industryBonusShort: 'Establishment',
        shareIconCompanies: [CompanyId.LMS, CompanyId.LNER, CompanyId.UERL],
        trackIconCompanies: [CompanyId.GWR, CompanyId.SR],
        lakeLabels: [],
        // Column first, then the doubled row.
        regionLabels: {
            Midlands: printedHex(13, 17),
            East: printedHex(15, 6),
            West: printedHex(8, 15),
            South: printedHex(16, 27)
        },
        regionBorders: true
    }
}

export function editionStyle(editionId: EditionId): EditionStyle {
    return EDITION_STYLES[editionId]
}
