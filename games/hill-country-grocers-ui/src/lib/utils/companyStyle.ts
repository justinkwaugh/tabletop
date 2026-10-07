import { CompanyId } from '@tabletop/hill-country-grocers'
import acsLogo from '$lib/images/logo_ACS.jpg'
import verLogo from '$lib/images/logo_V.jpg'
import ssLogo from '$lib/images/logo_SS.jpg'
import ccLogo from '$lib/images/logo_CC.jpg'
import bbLogo from '$lib/images/logo_BB.jpg'

export type CompanyStyle = { fill: string; text: string; light: string; logo: string }

export const COMPANY_STYLE: Record<CompanyId, CompanyStyle> = {
    [CompanyId.AlamoCity]: { fill: '#cf2129', text: '#ffffff', light: '#fdeceb', logo: acsLogo },
    [CompanyId.Verbena]: { fill: '#0f9447', text: '#ffffff', light: '#e9f6ee', logo: verLogo },
    [CompanyId.Streamside]: { fill: '#2f4f9f', text: '#ffffff', light: '#eaeff9', logo: ssLogo },
    [CompanyId.CompleteComestibles]: {
        fill: '#e07a24',
        text: '#2a1404',
        light: '#fdf1e6',
        logo: ccLogo
    },
    [CompanyId.Balcones]: { fill: '#6d6d6d', text: '#ffffff', light: '#efefef', logo: bbLogo }
}
