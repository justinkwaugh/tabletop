import { Link, Section, Text } from '@react-email/components'
import { ButtonFallback, CardButton, DarkCardEmail, darkStyles } from '../components/darkCard.js'
import type { Locale } from '../i18n.js'
import { timeDifferenceStartDateText } from '@tabletop/common'

export interface TimeDifferenceNoticeProps {
    username: string
    startsAt: Date
    preferencesUrl: string
    privacyUrl: string
    locale: Locale
}

// The notice is English until its wording settles and it is translated.
export const timeDifferenceNoticeStartDate = (startsAt: Date): string =>
    timeDifferenceStartDateText(startsAt, 'en-US')

export const TimeDifferenceNotice = ({
    username,
    startsAt,
    preferencesUrl,
    privacyUrl,
    locale,
}: TimeDifferenceNoticeProps) => {
    const startDate = timeDifferenceNoticeStartDate(startsAt)
    return (
        <DarkCardEmail
            locale={locale}
            preview={`From ${startDate}, other players will see your time difference from them. You can turn this off.`}
            eyebrow="A change to what other players see"
            heading="Your time difference"
            subline={`Hi ${username}. From ${startDate}, Board Together will show other players how many hours ahead of or behind them you are, so people can find games with players whose hours suit theirs.`}
            footer={
                <>
                    The details are in our{' '}
                    <Link href={privacyUrl} style={darkStyles.footerLink}>
                        Privacy Policy
                    </Link>
                    , along with how to contact us.{' '}
                    <ButtonFallback url={preferencesUrl} locale={locale} />
                </>
            }
        >
            <Section style={darkStyles.panel}>
                <Text style={darkStyles.panelValue}>What they'll see</Text>
                <Text style={darkStyles.panelDetail}>
                    The difference from their own time, rounded to whole hours, such as "6 h behind
                    you" or "same time as you". In games with a pace under a day, if they're waiting
                    on you, they may also see roughly what time it is for you, such as "3 am for
                    them". They'll never see your time zone, region or country.
                </Text>
            </Section>
            <Section style={darkStyles.panel}>
                <Text style={darkStyles.panelValue}>Who sees it, and where</Text>
                <Text style={darkStyles.panelDetail}>
                    Only signed-in players, and only next to games: games you've opened for others
                    to join, and games under a day where it's your turn. It never appears on public
                    pages, in emails or on Discord.
                </Text>
            </Section>
            <Section style={darkStyles.panel}>
                <Text style={darkStyles.panelValue}>Turning it off</Text>
                <Text style={darkStyles.panelDetail}>
                    If you'd rather not show it, turn off "Show my time difference to other players"
                    in Preferences. The switch works now, and turning it off stops it showing
                    everywhere at once. You can change it any time.
                </Text>
            </Section>
            <CardButton href={preferencesUrl}>Open Preferences</CardButton>
        </DarkCardEmail>
    )
}

export default TimeDifferenceNotice

TimeDifferenceNotice.PreviewProps = {
    username: 'Dana',
    startsAt: new Date('2026-11-26T12:00:00Z'),
    preferencesUrl: 'https://example.com/?preferences',
    privacyUrl: 'https://example.com/privacy',
    locale: 'en',
} satisfies TimeDifferenceNoticeProps
