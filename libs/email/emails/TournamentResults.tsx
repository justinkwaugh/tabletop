import {
    Body,
    Button,
    Column,
    Container,
    Font,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from '@react-email/components'
import type { CSSProperties } from 'react'

export interface TournamentResultsRow {
    rank: number
    name: string
    wins: number
    score: number
    tiebreak?: number
    recipient: boolean
}

interface TournamentResultsProps {
    tournamentName: string
    title: string
    winners: string[]
    standings: TournamentResultsRow[]
    url?: string
}

const palette = {
    canvas: '#111827',
    card: '#1f2937',
    cardBorder: '#374151',
    raised: '#293950',
    raisedBorder: '#6496df80',
    highlight: '#24314a',
    text: '#f9fafb',
    muted: '#9ca3af',
    faint: '#6b7280',
    divider: '#374151',
    blue: '#93c5fd',
    brandBlue: '#4a7fd0',
    button: '#2563eb',
    buttonBorder: '#3b82f6',
    gold: '#fbbf24',
    you: '#fdba74',
}

const fontStack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const numberStack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

const styles = {
    body: {
        margin: 0,
        padding: 0,
        backgroundColor: palette.canvas,
        fontFamily: fontStack,
        WebkitFontSmoothing: 'antialiased',
    },
    container: { maxWidth: '600px', margin: '0 auto', padding: '32px 16px' },
    wordmark: { textAlign: 'center', padding: '0 0 20px' },
    wordmarkBoard: {
        fontSize: '18px',
        fontWeight: 800,
        letterSpacing: '0.04em',
        color: palette.brandBlue,
        textDecoration: 'none',
    },
    wordmarkTogether: {
        fontSize: '18px',
        fontWeight: 300,
        letterSpacing: '0.04em',
        color: palette.muted,
        textDecoration: 'none',
    },
    card: {
        backgroundColor: palette.card,
        border: `1px solid ${palette.cardBorder}`,
        borderRadius: '12px',
        padding: '32px 32px 28px',
    },
    eyebrow: {
        margin: 0,
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: palette.blue,
    },
    heading: {
        margin: '10px 0 6px',
        fontSize: '30px',
        lineHeight: '1.1',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: palette.text,
    },
    subline: { margin: 0, fontSize: '15px', lineHeight: '1.6', color: palette.muted },
    champion: {
        marginTop: '24px',
        backgroundColor: palette.raised,
        border: `1px solid ${palette.raisedBorder}`,
        borderRadius: '10px',
        padding: '18px 20px',
    },
    championLabel: {
        margin: 0,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: palette.gold,
    },
    championName: {
        margin: '6px 0 0',
        fontSize: '22px',
        lineHeight: '1.25',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: palette.text,
    },
    placement: { margin: '8px 0 0', fontSize: '14px', lineHeight: '1.5', color: '#d1d5db' },
    sectionLabel: {
        margin: '28px 0 8px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: palette.muted,
    },
    headerCell: {
        margin: 0,
        padding: '8px 0',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: palette.faint,
    },
    cell: {
        margin: 0,
        padding: '10px 0',
        fontSize: '15px',
        lineHeight: '1.3',
        color: palette.text,
        fontFamily: numberStack,
    },
    footnote: { margin: '10px 0 0', fontSize: '12px', lineHeight: '1.5', color: palette.faint },
    button: {
        display: 'inline-block',
        backgroundColor: palette.button,
        border: `1px solid ${palette.buttonBorder}`,
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: '20px',
        padding: '13px 24px',
        textDecoration: 'none',
    },
    footer: { margin: 0, fontSize: '12px', lineHeight: '1.6', color: palette.faint },
    footerLink: { color: palette.muted, textDecoration: 'underline' },
} satisfies Record<string, CSSProperties>

const formatNames = (names: string[]): string => {
    if (names.length === 0) return 'Nobody'
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

const formatScore = (value: number): string =>
    value.toLocaleString('en-US', { maximumFractionDigits: 3 })

function ordinal(rank: number): string {
    const remainder = rank % 100
    if (remainder >= 11 && remainder <= 13) return `${rank}th`
    switch (rank % 10) {
        case 1:
            return `${rank}st`
        case 2:
            return `${rank}nd`
        case 3:
            return `${rank}rd`
        default:
            return `${rank}th`
    }
}

const numeric = (align: 'left' | 'right', width?: string): CSSProperties => ({
    width,
    textAlign: align,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
})

export const TournamentResults = ({
    tournamentName,
    title,
    winners,
    standings,
    url = ``,
}: TournamentResultsProps) => {
    const shared = winners.length > 1
    const winnerNames = formatNames(winners)
    const previewText = `${tournamentName} has finished. ${winnerNames} ${shared ? 'share' : 'takes'} first place.`
    const showTiebreak = standings.some((row) => row.tiebreak !== undefined)
    const recipient = standings.find((row) => row.recipient)
    const rowStyle = (row: TournamentResultsRow, last: boolean): CSSProperties => ({
        borderBottom: last ? undefined : `1px solid ${palette.divider}`,
        backgroundColor: row.recipient ? palette.highlight : undefined,
    })
    const nameStyle = (row: TournamentResultsRow): CSSProperties => ({
        ...styles.cell,
        fontWeight: row.recipient || row.rank === 1 ? 600 : 400,
        color: row.recipient ? palette.you : palette.text,
        paddingLeft: '8px',
        paddingRight: '8px',
    })
    return (
        <Html>
            <Head>
                <meta name="color-scheme" content="dark" />
                <meta name="supported-color-schemes" content="dark" />
                <Font
                    fontFamily="Inter"
                    fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
                    webFont={{
                        url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
                        format: 'woff2',
                    }}
                    fontWeight={400}
                    fontStyle="normal"
                />
            </Head>
            <Preview>{previewText}</Preview>
            <Body style={styles.body}>
                <Container style={styles.container}>
                    <Section style={styles.wordmark}>
                        <Link href={url} style={styles.wordmarkBoard}>
                            BOARD
                        </Link>
                        <Link href={url} style={styles.wordmarkTogether}>
                            {' '}
                            TOGETHER
                        </Link>
                    </Section>

                    <Section style={styles.card}>
                        <Text style={styles.eyebrow}>Tournament complete</Text>
                        <Heading as="h1" style={styles.heading}>
                            {tournamentName}
                        </Heading>
                        <Text style={styles.subline}>
                            {title} · {standings.length} players
                        </Text>

                        <Section style={styles.champion}>
                            <Text style={styles.championLabel}>
                                {shared ? 'Champions' : 'Champion'}
                            </Text>
                            <Text style={styles.championName}>
                                <span style={{ color: palette.gold }}>★</span> {winnerNames}
                            </Text>
                            {recipient && (
                                <Text style={styles.placement}>
                                    {recipient.rank === 1
                                        ? shared
                                            ? 'You share the top of the table. Congratulations!'
                                            : 'That is you. Congratulations!'
                                        : `You finished ${ordinal(recipient.rank)} with ${recipient.wins} ${recipient.wins === 1 ? 'win' : 'wins'}.`}
                                </Text>
                            )}
                        </Section>

                        <Text style={styles.sectionLabel}>Final standings</Text>
                        <Section>
                            <Row style={{ borderBottom: `1px solid ${palette.divider}` }}>
                                <Column style={numeric('left', '32px')}>
                                    <Text style={styles.headerCell}>#</Text>
                                </Column>
                                <Column style={{ ...numeric('left'), paddingLeft: '8px' }}>
                                    <Text style={styles.headerCell}>Player</Text>
                                </Column>
                                <Column style={numeric('right', '52px')}>
                                    <Text style={styles.headerCell}>Wins</Text>
                                </Column>
                                <Column style={numeric('right', '64px')}>
                                    <Text style={styles.headerCell}>Score</Text>
                                </Column>
                                {showTiebreak && (
                                    <Column style={numeric('right', '84px')}>
                                        <Text style={styles.headerCell}>Tiebreak</Text>
                                    </Column>
                                )}
                            </Row>
                            {standings.map((row, index) => (
                                <Row
                                    key={`${row.rank}-${row.name}`}
                                    style={rowStyle(row, index === standings.length - 1)}
                                >
                                    <Column style={numeric('left', '32px')}>
                                        <Text style={{ ...styles.cell, color: palette.faint }}>
                                            {row.rank}
                                        </Text>
                                    </Column>
                                    <Column style={numeric('left')}>
                                        <Text style={nameStyle(row)}>
                                            {row.name}
                                            {row.rank === 1 && (
                                                <span style={{ color: palette.gold }}> ★</span>
                                            )}
                                        </Text>
                                    </Column>
                                    <Column style={numeric('right', '52px')}>
                                        <Text style={styles.cell}>{row.wins}</Text>
                                    </Column>
                                    <Column style={numeric('right', '64px')}>
                                        <Text style={styles.cell}>{formatScore(row.score)}</Text>
                                    </Column>
                                    {showTiebreak && (
                                        <Column style={numeric('right', '84px')}>
                                            <Text style={styles.cell}>
                                                {row.tiebreak === undefined
                                                    ? '—'
                                                    : formatScore(row.tiebreak)}
                                            </Text>
                                        </Column>
                                    )}
                                </Row>
                            ))}
                        </Section>
                        {showTiebreak && (
                            <Text style={styles.footnote}>
                                Tiebreak is the sum of each player's final scores from their games.
                            </Text>
                        )}

                        <Section style={{ textAlign: 'center', padding: '28px 0 8px' }}>
                            <Button href={url} style={styles.button}>
                                View the tournament
                            </Button>
                        </Section>
                    </Section>

                    <Hr style={{ borderColor: palette.cardBorder, margin: '24px 0 16px' }} />
                    <Text style={styles.footer}>
                        You played in this tournament on Board Together. If the button does not
                        work, open{' '}
                        <Link href={url} style={styles.footerLink}>
                            {url}
                        </Link>
                        .
                    </Text>
                </Container>
            </Body>
        </Html>
    )
}

TournamentResults.PreviewProps = {
    tournamentName: 'Fresh Fish Autumn Mini',
    title: 'Fresh Fish',
    winners: ['Alice'],
    standings: [
        { rank: 1, name: 'Alice', wins: 3, score: 2.5, tiebreak: 142, recipient: false },
        { rank: 2, name: 'Bob', wins: 3, score: 2.5, tiebreak: 137, recipient: true },
        { rank: 3, name: 'Carol', wins: 1, score: 1, tiebreak: 120, recipient: false },
        { rank: 4, name: 'Dave', wins: 0, score: 0, tiebreak: 98, recipient: false },
    ],
    url: 'https://boardtogether.games/tournaments/fresh-fish-autumn-mini',
} as TournamentResultsProps

export default TournamentResults
