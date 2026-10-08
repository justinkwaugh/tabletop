import { CompanyId } from '@tabletop/hill-country-grocers'

export type CompanyStyle = { fill: string; tint: string; text: string; light: string }

export const COMPANY_STYLE: Record<CompanyId, CompanyStyle> = {
    [CompanyId.AlamoCity]: { fill: '#cf2129', tint: '#f3a7aa', text: '#ffffff', light: '#fdeceb' },
    [CompanyId.Verbena]: { fill: '#0f9447', tint: '#9fd9b5', text: '#ffffff', light: '#e9f6ee' },
    [CompanyId.Streamside]: { fill: '#2f4f9f', tint: '#aebde6', text: '#ffffff', light: '#eaeff9' },
    [CompanyId.CompleteComestibles]: {
        fill: '#e07a24',
        tint: '#f6c597',
        text: '#2a1404',
        light: '#fdf1e6'
    },
    [CompanyId.Balcones]: { fill: '#6d6d6d', tint: '#c8c8c8', text: '#ffffff', light: '#efefef' }
}
