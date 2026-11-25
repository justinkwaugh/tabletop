import type { User } from '@tabletop/common'
import { baseLocale, toLocale, type Locale } from '#paraglide/runtime.js'

export { m } from '#paraglide/messages.js'
export { baseLocale, locales, type Locale } from '#paraglide/runtime.js'

type LocaleChoices = Pick<User, 'preferences' | 'seenLocale'>

export function matchLocale(tag: string | undefined): Locale | undefined {
    if (tag === undefined) return undefined
    return toLocale(tag) ?? toLocale(tag.split('-')[0])
}

export function supportedLocale(tag: string | undefined): Locale {
    return matchLocale(tag) ?? baseLocale
}

export function messageLocale(user: LocaleChoices | undefined): Locale {
    return supportedLocale(user?.preferences?.locale ?? user?.seenLocale)
}

export function replyLocale(
    user: LocaleChoices | undefined,
    platformTag: string | undefined,
): Locale {
    return (
        matchLocale(user?.preferences?.locale) ??
        matchLocale(platformTag) ??
        supportedLocale(user?.seenLocale)
    )
}

export type Message<Inputs> = (inputs: Inputs, options: { locale: Locale }) => string
