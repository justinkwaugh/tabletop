import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
    formatNames,
} from '../components/darkCard.js'
import { baseLocale, m, type Locale, type Message } from '../i18n.js'

export interface LeagueSeasonStartLevel {
    name: string
    moved?: 'up' | 'down' | 'merged'
}

export interface LeagueSeasonStartProps {
    leagueName: string
    title: string
    seasonNumber: number
    groupName: string
    level?: LeagueSeasonStartLevel
    opponents: string[]
    gamesEach: number
    url?: string
    locale: Locale
}

const MOVED_MESSAGES: Record<
    NonNullable<LeagueSeasonStartLevel['moved']>,
    Message<{ level: string }>
> = {
    up: m.email_league_season_start_moved_up,
    merged: m.email_league_season_start_merged,
    down: m.email_league_season_start_moved_down,
}

export const LeagueSeasonStart = ({
    leagueName,
    title,
    seasonNumber,
    groupName,
    level,
    opponents,
    gamesEach,
    url = ``,
    locale,
}: LeagueSeasonStartProps) => {
    const names = formatNames(
        opponents,
        m.email_league_season_start_no_opponent_names({}, { locale }),
        locale,
    )
    return (
        <DarkCardEmail
            locale={locale}
            preview={m.email_league_season_start_preview(
                { league: leagueName, season: seasonNumber, group: groupName },
                { locale },
            )}
            wordmarkHref={url}
            eyebrow={m.email_league_season_start_eyebrow({ season: seasonNumber }, { locale })}
            heading={leagueName}
            subline={
                level
                    ? m.email_league_season_start_subline_level(
                          { title, level: level.name },
                          { locale },
                      )
                    : m.email_league_season_start_subline_seeding({ title }, { locale })
            }
            footer={
                <>
                    {m.email_league_season_start_footer({}, { locale })}{' '}
                    <ButtonFallback url={url} locale={locale} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>
                    {m.email_league_season_start_group({ group: groupName }, { locale })}
                </Text>
                {level?.moved && (
                    <Text style={styles.panelDetail}>
                        {MOVED_MESSAGES[level.moved]({ level: level.name }, { locale })}
                    </Text>
                )}
                <Text style={styles.panelDetail}>
                    {m.email_league_season_start_games({ games: gamesEach, names }, { locale })}
                    {!level && ` ${m.email_league_season_start_seeding_note({}, { locale })}`}
                </Text>
            </Section>
            <CardButton href={url}>{m.email_league_season_start_button({}, { locale })}</CardButton>
        </DarkCardEmail>
    )
}

LeagueSeasonStart.PreviewProps = {
    leagueName: 'Fresh Fish League',
    title: 'Fresh Fish',
    seasonNumber: 2,
    groupName: 'B1',
    level: { name: 'B', moved: 'up' },
    opponents: ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank'],
    gamesEach: 4,
    url: 'https://boardtogether.games/tournaments/league-group',
    locale: baseLocale,
} satisfies LeagueSeasonStartProps

export default LeagueSeasonStart
