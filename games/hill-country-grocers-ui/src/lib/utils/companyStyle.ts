import { CompanyId } from '@tabletop/hill-country-grocers'
import acsLogo from '$lib/images/logo_ACS.png'
import verLogo from '$lib/images/logo_V.png'
import ssLogo from '$lib/images/logo_SS.png'
import ccLogo from '$lib/images/logo_CC.png'
import bbLogo from '$lib/images/logo_BB.jpg'

export type CompanyStyle = { fill: string; tint: string; text: string; light: string; logo: string }

export const COMPANY_STYLE: Record<CompanyId, CompanyStyle> = {
    [CompanyId.AlamoCity]: {
        fill: '#cf2129',
        tint: '#f3a7aa',
        text: '#ffffff',
        light: '#fdeceb',
        logo: acsLogo
    },
    [CompanyId.Verbena]: {
        fill: '#0f9447',
        tint: '#9fd9b5',
        text: '#ffffff',
        light: '#e9f6ee',
        logo: verLogo
    },
    [CompanyId.Streamside]: {
        fill: '#2f4f9f',
        tint: '#aebde6',
        text: '#ffffff',
        light: '#eaeff9',
        logo: ssLogo
    },
    [CompanyId.CompleteComestibles]: {
        fill: '#e07a24',
        tint: '#f6c597',
        text: '#2a1404',
        light: '#fdf1e6',
        logo: ccLogo
    },
    [CompanyId.Balcones]: {
        fill: '#6d6d6d',
        tint: '#c8c8c8',
        text: '#ffffff',
        light: '#efefef',
        logo: bbLogo
    }
}
