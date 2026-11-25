import { Type } from 'typebox'
import { assertExists, type User } from '@tabletop/common'
import {
    baseLocale,
    defineCustomClientStrategy,
    extractLocaleFromNavigator,
    getLocale,
    locales,
    toLocale,
    type Locale
} from '$lib/paraglide/runtime'
import { readStoredValue, removeStoredValue, writeStoredValue } from '$lib/utils/storedValue'
import { PSEUDO_LOCALE } from './pseudoLocale.js'

export type LocaleOption = { locale: Locale; name: string }

const DEVICE_LOCALE_KEY = 'locale'

let pageAccountLocale: Locale | undefined
let pageDeviceLocale: Locale | undefined

defineCustomClientStrategy('custom-account', {
    getLocale: () => pageAccountLocale,
    setLocale: () => undefined
})

defineCustomClientStrategy('custom-device', {
    getLocale: () => pageDeviceLocale,
    setLocale: () => undefined
})

export function startPageLocale(user: User | undefined) {
    pageAccountLocale = accountLocale(user)
    pageDeviceLocale = deviceLocale()
}

export function setDocumentLanguage(document: Document) {
    document.documentElement.lang = getLocale()
}

export function pageShowsLocaleOf(user: User | undefined): boolean {
    return getLocale() === localeForUser(user)
}

export function localeForUser(user: User | undefined): Locale {
    return accountLocale(user) ?? deviceLocale() ?? extractLocaleFromNavigator() ?? baseLocale
}

export function deviceLocale(): Locale | undefined {
    return toLocale(readStoredValue(DEVICE_LOCALE_KEY, Type.String()))
}

export function carryDeviceLocaleToAccount(user: User, save: (locale: Locale) => void) {
    const locale = deviceLocale()
    if (locale && !accountLocale(user)) save(locale)
}

export function switchDeviceLocale(locale: Locale | undefined) {
    if (locale) writeStoredValue(DEVICE_LOCALE_KEY, locale)
    else removeStoredValue(DEVICE_LOCALE_KEY)
    window.location.reload()
}

export function localeOptions({
    includePseudoLocale
}: {
    includePseudoLocale: boolean
}): LocaleOption[] {
    return locales
        .filter((locale) => includePseudoLocale || locale !== PSEUDO_LOCALE)
        .map((locale) => ({ locale, name: localeName(locale) }))
}

function accountLocale(user: User | undefined): Locale | undefined {
    return toLocale(user?.preferences?.locale)
}

function localeName(locale: Locale): string {
    if (locale === PSEUDO_LOCALE) return 'Pseudo-English (test)'
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale)
    assertExists(name, `No display name for ${locale}`)
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}
