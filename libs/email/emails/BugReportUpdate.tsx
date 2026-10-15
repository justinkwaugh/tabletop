import { Link, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { CardButton, DarkCardEmail, darkPalette, darkStyles } from '../components/darkCard.js'

interface BugReportUpdateProps {
    eyebrow: string
    heading: string
    game: string
    lead: string
    note?: string
    closing?: string
    quote: string
    gameUrl: string
    postUrl: string
    inviteUrl: string
    footer: string
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
}: BugReportUpdateProps) => {
    return (
        <DarkCardEmail
            preview={lead}
            wordmarkHref={gameUrl}
            eyebrow={eyebrow}
            heading={heading}
            subline={game}
            footer={
                <>
                    {footer} Your report lives in the bug-reports forum on our Discord; not on the
                    server yet?{' '}
                    <Link href={inviteUrl} style={styles.footerLink}>
                        Come say hi
                    </Link>
                    .
                </>
            }
        >
            <Text style={styles.paragraph}>{lead}</Text>
            {note && <Text style={styles.paragraph}>{note}</Text>}
            {closing && <Text style={styles.paragraph}>{closing}</Text>}

            <Section style={styles.panel}>
                <Text style={styles.quoteLabel}>You wrote</Text>
                <Text style={styles.quoteText}>“{quote}”</Text>
            </Section>

            <CardButton href={gameUrl}>Back to your game</CardButton>
            <Section style={{ textAlign: 'center', padding: '8px 0 0' }}>
                <Link href={postUrl} style={styles.secondaryLink}>
                    Follow your report on Discord →
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
} satisfies BugReportUpdateProps

export default BugReportUpdate
