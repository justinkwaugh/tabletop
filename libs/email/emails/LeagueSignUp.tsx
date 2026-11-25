import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'
import { formatEmailDeadline } from '../components/format.js'
import { baseLocale, m, type Locale } from '../i18n.js'

export interface LeagueSignUpProps {
    reminder: boolean
    leagueName: string
    title: string
    seasonNumber: number
    level: string
    closesAt: number
    url?: string
    locale: Locale
    timeZone?: string
}

export const LeagueSignUp = ({
    reminder,
    leagueName,
    title,
    seasonNumber,
    level,
    closesAt,
    url = ``,
    locale,
    timeZone,
}: LeagueSignUpProps) => {
    const place = { league: leagueName, season: seasonNumber, level }
    return (
        <DarkCardEmail
            locale={locale}
            preview={
                reminder
                    ? m.email_league_sign_up_preview_reminder(place, { locale })
                    : m.email_league_sign_up_preview_open(place, { locale })
            }
            wordmarkHref={url}
            eyebrow={
                reminder
                    ? m.email_league_sign_up_eyebrow_reminder({}, { locale })
                    : m.email_league_sign_up_eyebrow_open({}, { locale })
            }
            heading={leagueName}
            subline={m.email_league_sign_up_subline({ title, season: seasonNumber }, { locale })}
            footer={
                <>
                    {m.email_league_sign_up_footer({}, { locale })}{' '}
                    <ButtonFallback url={url} locale={locale} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>
                    {reminder
                        ? m.email_league_sign_up_place_unconfirmed({ level }, { locale })
                        : m.email_league_sign_up_place_held({ level }, { locale })}
                </Text>
                <Text style={styles.panelDetail}>
                    {m.email_league_sign_up_detail(
                        { closes: formatEmailDeadline(closesAt, locale, timeZone) },
                        { locale },
                    )}
                </Text>
            </Section>
            <CardButton href={url}>{m.email_league_sign_up_button({}, { locale })}</CardButton>
        </DarkCardEmail>
    )
}

LeagueSignUp.PreviewProps = {
    reminder: false,
    leagueName: 'Fresh Fish League',
    title: 'Fresh Fish',
    seasonNumber: 2,
    level: 'B',
    closesAt: Date.UTC(2026, 9, 23, 18),
    url: 'https://boardtogether.games/leagues/fresh-fish-league',
    locale: baseLocale,
} satisfies LeagueSignUpProps

export default LeagueSignUp
