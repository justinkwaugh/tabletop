import { Locale as DiscordLocale, type LocalizationMap } from 'discord-api-types/v10'
import { baseLocale, locales, type Locale, type Message } from '@tabletop/email/i18n'

const DISCORD_LOCALES: Record<Exclude<Locale, typeof baseLocale>, DiscordLocale[]> = {
    da: [DiscordLocale.Danish],
    de: [DiscordLocale.German],
    el: [DiscordLocale.Greek],
    es: [DiscordLocale.SpanishES, DiscordLocale.SpanishLATAM],
    fr: [DiscordLocale.French],
    hu: [DiscordLocale.Hungarian],
    it: [DiscordLocale.Italian],
    ja: [DiscordLocale.Japanese],
    nl: [DiscordLocale.Dutch],
    pl: [DiscordLocale.Polish],
    pt: [DiscordLocale.PortugueseBR],
    sv: [DiscordLocale.Swedish]
}

export function discordLocalizations(message: Message<object>): LocalizationMap {
    return Object.fromEntries(
        locales.flatMap((locale) =>
            locale === baseLocale
                ? []
                : DISCORD_LOCALES[locale].map((discordLocale) => [
                      discordLocale,
                      message({}, { locale })
                  ])
        )
    )
}
