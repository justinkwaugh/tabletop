import { Column, Row, Section, Text } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import type { TiebreakRule } from '@tabletop/common'
import { m, type Locale, type Message } from '../i18n.js'
import { darkPalette, darkStyles, fontStack, formatNames } from './darkCard.js'

export interface StandingsRow {
    rank: number
    name: string
    wins: number
    score: number
    averagePlace?: string
    tiebreak?: string
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

const formatScore = (value: number, locale: Locale): string =>
    value.toLocaleString(locale, { maximumFractionDigits: 3 })

const TIEBREAK_DESCRIPTIONS: Record<TiebreakRule, Message<object>> = {
    pointsBehind: m.email_standings_tiebreak_points_behind,
    shareOfWinner: m.email_standings_tiebreak_share_of_winner,
}

const tiebreakDescription = (rule: TiebreakRule | undefined, locale: Locale): string =>
    (rule ? TIEBREAK_DESCRIPTIONS[rule] : m.email_standings_tiebreak_score_sum)({}, { locale })

const numeric = (align: 'left' | 'right', width?: string): CSSProperties => ({
    width,
    textAlign: align,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
})

export const ordinal = (place: number, locale: Locale): string =>
    m.email_ordinal({ place }, { locale })

export const ChampionPanel = ({
    winners,
    locale,
    children,
}: {
    winners: string[]
    locale: Locale
    children?: ReactNode
}) => (
    <Section style={styles.panel}>
        <Text style={styles.championLabel}>
            {winners.length > 1
                ? m.email_standings_champions({}, { locale })
                : m.email_standings_champion({}, { locale })}
        </Text>
        <Text style={styles.championName}>
            <span style={{ color: palette.gold }}>★</span>{' '}
            {formatNames(winners, m.email_standings_nobody({}, { locale }), locale)}
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
    tiebreakRule,
    ranksByAveragePlace = false,
    starWinner = true,
    locale,
}: {
    label: string
    rows: StandingsRow[]
    tiebreakRule?: TiebreakRule
    ranksByAveragePlace?: boolean
    starWinner?: boolean
    locale: Locale
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
                        <Text style={styles.headerCell}>
                            {m.email_standings_column_player({}, { locale })}
                        </Text>
                    </Column>
                    <Column style={numeric('right', '52px')}>
                        <Text style={styles.headerCell}>
                            {m.email_standings_column_wins({}, { locale })}
                        </Text>
                    </Column>
                    <Column style={numeric('right', '64px')}>
                        <Text style={styles.headerCell}>
                            {ranksByAveragePlace
                                ? m.email_standings_column_average_place({}, { locale })
                                : m.email_standings_column_score({}, { locale })}
                        </Text>
                    </Column>
                    {showTiebreak && (
                        <Column style={numeric('right', '84px')}>
                            <Text style={styles.headerCell}>
                                {m.email_standings_column_tiebreak({}, { locale })}
                            </Text>
                        </Column>
                    )}
                </Row>
                {rows.map((row, index) => (
                    <Row
                        key={`${row.rank}-${row.name}`}
                        style={rowStyle(row, index === rows.length - 1)}
                    >
                        <Column style={numeric('left', '32px')}>
                            <Text style={{ ...styles.cell, color: palette.faint }}>
                                {row.rank.toLocaleString(locale)}
                            </Text>
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
                            <Text style={styles.cell}>{row.wins.toLocaleString(locale)}</Text>
                        </Column>
                        <Column style={numeric('right', '64px')}>
                            <Text style={styles.cell}>
                                {ranksByAveragePlace
                                    ? (row.averagePlace ?? '—')
                                    : formatScore(row.score, locale)}
                            </Text>
                        </Column>
                        {showTiebreak && (
                            <Column style={numeric('right', '84px')}>
                                <Text style={styles.cell}>{row.tiebreak ?? '—'}</Text>
                            </Column>
                        )}
                    </Row>
                ))}
            </Section>
            {ranksByAveragePlace && (
                <Text style={styles.footnote}>
                    {m.email_standings_placement_scoring({}, { locale })}
                </Text>
            )}
            {showTiebreak && (
                <Text style={styles.footnote}>{tiebreakDescription(tiebreakRule, locale)}</Text>
            )}
        </>
    )
}
