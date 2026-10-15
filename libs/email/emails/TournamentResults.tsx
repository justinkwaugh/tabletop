import { Column, Row, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkPalette,
    darkStyles,
    fontStack,
    formatNames,
} from '../components/darkCard.js'

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
    ...darkPalette,
    highlight: '#24314a',
    divider: '#374151',
    you: '#fdba74',
}

const styles = {
    ...darkStyles,
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
    placement: { margin: '8px 0 0', fontSize: '14px', lineHeight: '1.5', color: palette.bodyText },
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
        fontFamily: fontStack,
    },
    footnote: { margin: '10px 0 0', fontSize: '12px', lineHeight: '1.5', color: palette.faint },
} satisfies Record<string, CSSProperties>

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
    const winnerNames = formatNames(winners, 'Nobody')
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
        <DarkCardEmail
            preview={previewText}
            wordmarkHref={url}
            eyebrow="Tournament complete"
            heading={tournamentName}
            subline={`${title} · ${standings.length} players`}
            footer={
                <>
                    You played in this tournament on Board Together. <ButtonFallback url={url} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.championLabel}>{shared ? 'Champions' : 'Champion'}</Text>
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
                            <Text style={{ ...styles.cell, color: palette.faint }}>{row.rank}</Text>
                        </Column>
                        <Column style={numeric('left')}>
                            <Text style={nameStyle(row)}>
                                {row.name}
                                {row.rank === 1 && <span style={{ color: palette.gold }}> ★</span>}
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
                                    {row.tiebreak === undefined ? '—' : formatScore(row.tiebreak)}
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

            <CardButton href={url}>View the tournament</CardButton>
        </DarkCardEmail>
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
} satisfies TournamentResultsProps

export default TournamentResults
