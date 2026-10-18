import { Column, Row, Section, Text } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import { darkPalette, darkStyles, fontStack, formatNames } from './darkCard.js'

export interface StandingsRow {
    rank: number
    name: string
    wins: number
    score: number
    tiebreak?: number
    recipient: boolean
    // Set when the champion is not simply first place, such as when a substitute finished first.
    champion?: boolean
}

export const isChampion = (row: StandingsRow) => row.champion ?? row.rank === 1

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

const numeric = (align: 'left' | 'right', width?: string): CSSProperties => ({
    width,
    textAlign: align,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
})

export function ordinal(rank: number): string {
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

export const ChampionPanel = ({
    winners,
    children,
}: {
    winners: string[]
    children?: ReactNode
}) => (
    <Section style={styles.panel}>
        <Text style={styles.championLabel}>{winners.length > 1 ? 'Champions' : 'Champion'}</Text>
        <Text style={styles.championName}>
            <span style={{ color: palette.gold }}>★</span> {formatNames(winners, 'Nobody')}
        </Text>
        {children && <Text style={styles.placement}>{children}</Text>}
    </Section>
)

export const ResultPanel = ({ children }: { children: ReactNode }) => (
    <Section style={styles.panel}>
        <Text style={{ ...styles.placement, margin: 0 }}>{children}</Text>
    </Section>
)

export const StandingsTable = ({
    label,
    rows,
    starWinner = true,
}: {
    label: string
    rows: StandingsRow[]
    starWinner?: boolean
}) => {
    const showTiebreak = rows.some((row) => row.tiebreak !== undefined)
    const rowStyle = (row: StandingsRow, last: boolean): CSSProperties => ({
        borderBottom: last ? undefined : `1px solid ${palette.divider}`,
        backgroundColor: row.recipient ? palette.highlight : undefined,
    })
    const nameStyle = (row: StandingsRow): CSSProperties => ({
        ...styles.cell,
        fontWeight: row.recipient || isChampion(row) ? 600 : 400,
        color: row.recipient ? palette.you : palette.text,
        paddingLeft: '8px',
        paddingRight: '8px',
    })
    return (
        <>
            <Text style={styles.sectionLabel}>{label}</Text>
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
                {rows.map((row, index) => (
                    <Row
                        key={`${row.rank}-${row.name}`}
                        style={rowStyle(row, index === rows.length - 1)}
                    >
                        <Column style={numeric('left', '32px')}>
                            <Text style={{ ...styles.cell, color: palette.faint }}>{row.rank}</Text>
                        </Column>
                        <Column style={numeric('left')}>
                            <Text style={nameStyle(row)}>
                                {row.name}
                                {starWinner && isChampion(row) && (
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
        </>
    )
}
