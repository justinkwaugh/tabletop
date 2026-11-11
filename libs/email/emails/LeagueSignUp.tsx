import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'

export interface LeagueSignUpProps {
    reminder: boolean
    leagueName: string
    title: string
    seasonNumber: number
    level: string
    closesAt: number
    url?: string
}

const formatLeagueDate = (time: number): string =>
    `${new Date(time).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    })} UTC`

export const LeagueSignUp = ({
    reminder,
    leagueName,
    title,
    seasonNumber,
    level,
    closesAt,
    url = ``,
}: LeagueSignUpProps) => {
    const closes = formatLeagueDate(closesAt)
    const previewText = reminder
        ? `Sign-up for ${leagueName} Season ${seasonNumber} closes soon. Confirm your place in Level ${level}.`
        : `Sign-up for ${leagueName} Season ${seasonNumber} is open. Your place in Level ${level} is held.`
    return (
        <DarkCardEmail
            preview={previewText}
            wordmarkHref={url}
            eyebrow={reminder ? 'Sign-up closes soon' : 'Sign-up open'}
            heading={leagueName}
            subline={`${title} · Season ${seasonNumber}`}
            footer={
                <>
                    You have a place held in this league on Board Together.{' '}
                    <ButtonFallback url={url} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>
                    {reminder
                        ? `Your place in Level ${level} is not confirmed yet`
                        : `Your place in Level ${level} is held for you`}
                </Text>
                <Text style={styles.panelDetail}>
                    Confirm it before sign-up closes on {closes}. A place that is not confirmed goes
                    to the best player from the level below.
                </Text>
            </Section>
            <CardButton href={url}>Confirm your place</CardButton>
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
} satisfies LeagueSignUpProps

export default LeagueSignUp
