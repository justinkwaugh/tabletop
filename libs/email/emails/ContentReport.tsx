import { Link, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { CardButton, DarkCardEmail, darkStyles as styles } from '../components/darkCard.js'

export interface ContentReportProps {
    targetLabel: string
    reasonLabel: string
    content: string
    authorName?: string
    authorUserId?: string
    details?: string
    gameName: string
    gameUrl: string
    moderationUrl: string
    reporterName: string
    reporterUserId: string
    reportedAt: string
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <Section style={styles.panel}>
        <Text style={styles.panelDetail}>{label}</Text>
        <Text style={styles.panelValue}>{children}</Text>
    </Section>
)

export const ContentReport = ({
    targetLabel,
    reasonLabel,
    content,
    authorName,
    authorUserId,
    details,
    gameName,
    gameUrl,
    moderationUrl,
    reporterName,
    reporterUserId,
    reportedAt,
}: ContentReportProps) => (
    <DarkCardEmail
        preview={`${targetLabel} reported: ${reasonLabel}`}
        eyebrow="Content report"
        heading={`${targetLabel}: ${reasonLabel}`}
        subline={`Reported ${reportedAt} in ${gameName}. The reported player is never told who reported them.`}
        footer={
            <>
                Sent because a player used Report on Board Together.{' '}
                <Link href={gameUrl} style={styles.footerLink}>
                    Open the game
                </Link>
                .
            </>
        }
    >
        <Row label="Reported content">{content}</Row>
        {authorName && (
            <Row label="Belongs to">
                {authorName}
                {authorUserId ? ` (account ${authorUserId})` : ''}
            </Row>
        )}
        {details && <Row label="Details from the reporter">{details}</Row>}
        <Row label="Reported by">
            {reporterName} (account {reporterUserId})
        </Row>
        <CardButton href={moderationUrl}>Review in moderation</CardButton>
    </DarkCardEmail>
)

ContentReport.PreviewProps = {
    targetLabel: 'Chat message',
    reasonLabel: 'Bullying or harassment',
    content: "you're useless, uninstall",
    authorName: 'Bob',
    authorUserId: 'k3Jx9q',
    details: "They've said this in every game today.",
    gameName: 'Friday evening',
    gameUrl: 'https://boardtogether.games/game/abc',
    moderationUrl: 'https://boardtogether.games/admin/moderate/abc?message=m1',
    reporterName: 'alice',
    reporterUserId: 'Xp2a7a',
    reportedAt: '12 Nov 2026, 14:02 UTC',
} satisfies ContentReportProps

export default ContentReport
