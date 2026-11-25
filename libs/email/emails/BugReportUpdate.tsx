import { Link, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { CardButton, DarkCardEmail, darkPalette, darkStyles } from '../components/darkCard.js'
import { RichMessage } from '../components/richMessage.js'
import { baseLocale, m, type Locale } from '../i18n.js'

interface BugReportUpdateProps {
    eyebrow: string
    heading: string
    game: string
    lead: string
    note?: string
    closing?: string
    quote: string
    /** Absent for a hotseat game, which lives only in the reporter's browser. */
    gameUrl?: string
    postUrl: string
    inviteUrl: string
    footer: string
    locale: Locale
}

const styles = {
    ...darkStyles,
    paragraph: {
        margin: '20px 0 0',
        fontSize: '16px',
        lineHeight: '1.6',
        color: darkPalette.bodyText,
    },
    quoteLabel: {
        margin: 0,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: darkPalette.blue,
    },
    quoteText: {
        margin: '6px 0 0',
        fontSize: '15px',
        lineHeight: '1.5',
        fontStyle: 'italic',
        color: darkPalette.text,
    },
    secondaryLink: { fontSize: '14px', fontWeight: 600, color: darkPalette.blue },
} satisfies Record<string, CSSProperties>

export const BugReportUpdate = ({
    eyebrow,
    heading,
    game,
    lead,
    note,
    closing,
    quote,
    gameUrl,
    postUrl,
    inviteUrl,
    footer,
    locale,
}: BugReportUpdateProps) => {
    return (
        <DarkCardEmail
            locale={locale}
            preview={lead}
            wordmarkHref={gameUrl}
            eyebrow={eyebrow}
            heading={heading}
            subline={game}
            footer={
                <>
                    {footer}{' '}
                    <RichMessage
                        parts={m.email_bug_report_forum.parts({}, { locale })}
                        markup={{
                            invite: (text) => (
                                <Link href={inviteUrl} style={styles.footerLink}>
                                    {text}
                                </Link>
                            ),
                        }}
                    />
                </>
            }
        >
            <Text style={styles.paragraph}>{lead}</Text>
            {note && <Text style={styles.paragraph}>{note}</Text>}
            {closing && <Text style={styles.paragraph}>{closing}</Text>}

            <Section style={styles.panel}>
                <Text style={styles.quoteLabel}>
                    {m.email_bug_report_you_wrote({}, { locale })}
                </Text>
                <Text style={styles.quoteText}>
                    {m.email_bug_report_quote({ quote }, { locale })}
                </Text>
            </Section>

            {gameUrl && (
                <CardButton href={gameUrl}>
                    {m.email_bug_report_back_to_game({}, { locale })}
                </CardButton>
            )}
            <Section style={{ textAlign: 'center', padding: '8px 0 0' }}>
                <Link href={postUrl} style={styles.secondaryLink}>
                    {m.email_bug_report_follow_on_discord({}, { locale })}
                </Link>
            </Section>
        </DarkCardEmail>
    )
}

BugReportUpdate.PreviewProps = {
    eyebrow: 'Your bug report',
    heading: 'Found it!',
    game: 'Sol: Last Days of a Star · Sol Sweet Sol',
    lead: "Good news: we can make the bug you hit happen on our end too, so we know what's going on and a fix is on the way.",
    note: 'On phones the ability button sat underneath the card tray, so taps never reached it.',
    closing: 'Thanks for bearing with us!',
    quote: 'Accelerate ability impossible to trigger on mobile.',
    gameUrl: 'https://boardtogether.games/game/qidEk1NjzIRBEioOpoCGD',
    postUrl: 'https://discord.com/channels/1272765028621353041/1560030519620542515',
    inviteUrl: 'https://discord.gg/5ggK5VGGvA',
    footer: 'You reported this bug on BoardTogether.',
    locale: baseLocale,
} satisfies BugReportUpdateProps

export default BugReportUpdate
