import type { AxialCoordinates } from '@tabletop/common'
import { CompanyId, EditionId, HexKind, printedPointyHex } from '@tabletop/railheads'
import { HEX_FILL, MIDWEST_HEX_FILL } from './companyStyle.js'

export enum Flag {
    Germany = 'Germany',
    UnitedStates = 'UnitedStates'
}

export type LakeLabel = { name: string; at: AxialCoordinates; angle: number }

export type EditionStyle = {
    title: string
    flag: Flag
    titleStroke: string
    hexFill: Readonly<Record<HexKind, string>>
    endBonusName: string
    endBonusShort: string
    endBonusRule: string
    industryBonusName: string
    industryBonusShort: string
    shareIconCompanies: readonly CompanyId[]
    trackIconCompanies: readonly [CompanyId, CompanyId]
    lakeLabels: readonly LakeLabel[]
    regionLabels: Readonly<Record<string, AxialCoordinates>>
}

const EDITION_STYLES: Record<EditionId, EditionStyle> = {
    [EditionId.Germany]: {
        title: 'Germany',
        flag: Flag.Germany,
        titleStroke: '#3c5816',
        hexFill: HEX_FILL,
        endBonusName: 'Railroad Bonus',
        endBonusShort: 'Railroad',
        endBonusRule:
            'at every city, town or industry site where this railroad has the top disc, $1 a share for each disc beneath it',
        industryBonusName: 'Industry Bonus',
        industryBonusShort: 'Industry',
        shareIconCompanies: [CompanyId.KPEV, CompanyId.KSSE, CompanyId.GBSE],
        trackIconCompanies: [CompanyId.GBSE, CompanyId.KBSB],
        lakeLabels: [],
        regionLabels: {}
    },
    [EditionId.Midwest]: {
        title: 'The Midwest',
        flag: Flag.UnitedStates,
        titleStroke: '#2f6ea5',
        hexFill: MIDWEST_HEX_FILL,
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
        }
    }
}

export function editionStyle(editionId: EditionId): EditionStyle {
    return EDITION_STYLES[editionId]
}
