import { CompanyId, Industry } from '@tabletop/railheads'

export type CompanyStyle = { fill: string; text: string; edge: string }

// The charter colours printed on the Germany board.
export const COMPANY_STYLE: Record<CompanyId, CompanyStyle> = {
    [CompanyId.KPEV]: { fill: '#1f1f1d', text: '#ffffff', edge: '#000000' },
    [CompanyId.GBSE]: { fill: '#b8232a', text: '#ffffff', edge: '#6e1216' },
    [CompanyId.KSSE]: { fill: '#3e8a2e', text: '#ffffff', edge: '#1f4a16' },
    [CompanyId.KWSE]: { fill: '#ecd02a', text: '#2b2405', edge: '#8a780c' },
    [CompanyId.KBSB]: { fill: '#2c7fd3', text: '#ffffff', edge: '#164a80' }
}

export type IndustryStyle = { name: string; ring: string; mark: string }

export const INDUSTRY_STYLE: Record<Industry, IndustryStyle> = {
    [Industry.Cloth]: { name: 'Cloth', ring: '#4b4f9e', mark: '#3a3e8c' },
    [Industry.Grain]: { name: 'Grain', ring: '#d3a92a', mark: '#c99a1e' },
    [Industry.Brick]: { name: 'Brick', ring: '#7a2f17', mark: '#7a2f17' },
    [Industry.Anvil]: { name: 'Anvil', ring: '#6b6d68', mark: '#5c5e59' }
}
