import type { TiebreakRule } from '@tabletop/common'
import { ButtonFallback, CardButton, DarkCardEmail } from '../components/darkCard.js'
import {
    ChampionPanel,
    ordinal,
    ResultPanel,
    StandingsTable,
    type StandingsRow,
} from '../components/standings.js'
import { baseLocale, m, type Locale, type Message } from '../i18n.js'

export interface LeagueSeasonResultsProps {
    leagueName: string
    title: string
    seasonNumber: number
    groupName: string
    place: number
    movement: 'promoted' | 'relegated' | 'stayed' | 'seeded' | 'substitute'
    nextLevel: string
    champion?: string
    standings: StandingsRow[]
    tiebreakRule?: TiebreakRule
    ranksByAveragePlace?: boolean
    url?: string
    locale: Locale
}

const RESULT_MESSAGES: Record<
    LeagueSeasonResultsProps['movement'],
    Message<{ place: string; group: string; level: string; nextSeason: number }>
> = {
    seeded: m.email_league_season_results_seeded,
    promoted: m.email_league_season_results_promoted,
    relegated: m.email_league_season_results_relegated,
    stayed: m.email_league_season_results_stayed,
    substitute: m.email_league_season_results_substitute,
}

const resultText = ({
    seasonNumber,
    groupName,
    place,
    movement,
    nextLevel,
    locale,
}: LeagueSeasonResultsProps): string =>
    RESULT_MESSAGES[movement](
        {
            place: ordinal(place, locale),
            group: groupName,
            level: nextLevel,
            nextSeason: seasonNumber + 1,
        },
        { locale },
    )

export const leagueSeasonResultsName = ({
    movement,
    seasonNumber,
    locale,
}: Pick<LeagueSeasonResultsProps, 'movement' | 'seasonNumber' | 'locale'>): string =>
    movement === 'seeded'
        ? m.email_league_season_name_seeding({}, { locale })
        : m.email_league_season_name({ season: seasonNumber }, { locale })

export const LeagueSeasonResults = (props: LeagueSeasonResultsProps) => {
    const {
        leagueName,
        title,
        groupName,
        champion,
        standings,
        tiebreakRule,
        ranksByAveragePlace,
        url = ``,
        locale,
    } = props
    const result = resultText(props)
    const season = leagueSeasonResultsName(props)
    return (
        <DarkCardEmail
            locale={locale}
            preview={`${m.email_league_season_results_preview({ league: leagueName, season }, { locale })} ${result}`}
            wordmarkHref={url}
            eyebrow={m.email_league_season_results_eyebrow({ season }, { locale })}
            heading={leagueName}
            subline={m.email_league_season_results_subline({ title, group: groupName }, { locale })}
            footer={
                <>
                    {m.email_league_season_results_footer({}, { locale })}{' '}
                    <ButtonFallback url={url} locale={locale} />
                </>
            }
        >
            {champion ? (
                <ChampionPanel winners={[champion]} locale={locale}>
                    {result}
                </ChampionPanel>
            ) : (
                <ResultPanel>{result}</ResultPanel>
            )}
            <StandingsTable
                label={m.email_league_season_results_standings({ group: groupName }, { locale })}
                rows={standings}
                tiebreakRule={tiebreakRule}
                ranksByAveragePlace={ranksByAveragePlace}
                starWinner={false}
                locale={locale}
            />
            <CardButton href={url}>
                {m.email_league_season_results_button({}, { locale })}
            </CardButton>
        </DarkCardEmail>
    )
}

LeagueSeasonResults.PreviewProps = {
    leagueName: 'Fresh Fish League',
    title: 'Fresh Fish',
    seasonNumber: 2,
    groupName: 'B1',
    place: 1,
    movement: 'promoted',
    nextLevel: 'A',
    champion: 'Alice',
    standings: [
        { rank: 1, name: 'Bob', wins: 3, score: 3, tiebreak: '-0.99', recipient: true },
        { rank: 2, name: 'Carol', wins: 2, score: 2, tiebreak: '-1.775', recipient: false },
        { rank: 3, name: 'Dave', wins: 1, score: 1, tiebreak: '-4.265', recipient: false },
        { rank: 4, name: 'Erin', wins: 1, score: 1, tiebreak: '-5.553', recipient: false },
    ],
    tiebreakRule: 'pointsBehind',
    url: 'https://boardtogether.games/leagues/fresh-fish-league?season=2',
    locale: baseLocale,
} satisfies LeagueSeasonResultsProps

export default LeagueSeasonResults
