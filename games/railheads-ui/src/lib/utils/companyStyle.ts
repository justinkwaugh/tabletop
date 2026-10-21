import { CompanyId, HexKind, Industry } from '@tabletop/railheads'

export type CompanyStyle = { fill: string; text: string; edge: string }

export const COMPANY_STYLE: Record<CompanyId, CompanyStyle> = {
    [CompanyId.KPEV]: { fill: '#1f1f1d', text: '#ffffff', edge: '#000000' },
    [CompanyId.GBSE]: { fill: '#b8232a', text: '#ffffff', edge: '#6e1216' },
    [CompanyId.KSSE]: { fill: '#3e8a2e', text: '#ffffff', edge: '#1f4a16' },
    [CompanyId.KWSE]: { fill: '#ecd02a', text: '#2b2405', edge: '#8a780c' },
    [CompanyId.KBSB]: { fill: '#2c7fd3', text: '#ffffff', edge: '#164a80' },
    [CompanyId.PRR]: { fill: '#b8232a', text: '#ffffff', edge: '#6e1216' },
    [CompanyId.BO]: { fill: '#2c7fd3', text: '#ffffff', edge: '#164a80' },
    [CompanyId.IC]: { fill: '#3e8a2e', text: '#ffffff', edge: '#1f4a16' },
    [CompanyId.ERIE]: { fill: '#ecd02a', text: '#2b2405', edge: '#8a780c' },
    [CompanyId.NYC]: { fill: '#1f1f1d', text: '#ffffff', edge: '#000000' }
}

export type IndustryStyle = { name: string; ring: string; mark: string; text: string }

export const INDUSTRY_STYLE: Record<Industry, IndustryStyle> = {
    [Industry.Cloth]: { name: 'Cloth', ring: '#4b4f9e', mark: '#3a3e8c', text: '#ffffff' },
    [Industry.Grain]: { name: 'Grain', ring: '#d3a92a', mark: '#c99a1e', text: '#2b2405' },
    [Industry.Brick]: { name: 'Brick', ring: '#7a2f17', mark: '#7a2f17', text: '#ffffff' },
    [Industry.Steel]: { name: 'Steel', ring: '#6b6d68', mark: '#5c5e59', text: '#ffffff' }
}

export const HEX_FILL: Record<HexKind, string> = {
    [HexKind.Countryside]: '#a9be88',
    [HexKind.City]: '#d9604c',
    [HexKind.Town]: '#e8ad66',
    [HexKind.Industry]: '#eee493'
}

export const MIDWEST_HEX_FILL: Record<HexKind, string> = {
    ...HEX_FILL,
    [HexKind.Countryside]: '#cdbd8e'
}

export const WATER_FILL = '#3d8bd0'

export const DEMAND_FILL = '#8a5a1c'

export function shareLabel(shortName: string): string {
    return shortName.replaceAll('.', '')
}
