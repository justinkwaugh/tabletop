import type { TiebreakRule } from '@tabletop/common'
import { ButtonFallback, CardButton, DarkCardEmail, formatNames } from '../components/darkCard.js'
import {
    ChampionPanel,
    isChampion,
    ordinal,
    StandingsTable,
    type StandingsRow,
} from '../components/standings.js'
import { baseLocale, m, type Locale } from '../i18n.js'

interface TournamentResultsProps {
    tournamentName: string
    title: string
    winners: string[]
    standings: StandingsRow[]
    tiebreakRule?: TiebreakRule
    ranksByAveragePlace?: boolean
    url?: string
    locale: Locale
}

const finishText = (row: StandingsRow, ranksByAveragePlace: boolean, locale: Locale): string => {
    const place = ordinal(row.rank, locale)
    return ranksByAveragePlace && row.averagePlace !== undefined
        ? m.email_tournament_results_finished_average_place(
              { place, averagePlace: row.averagePlace },
              { locale },
          )
        : m.email_tournament_results_finished_wins({ place, wins: row.wins }, { locale })
}

const recipientText = (
    recipient: StandingsRow,
    shared: boolean,
    ranksByAveragePlace: boolean,
    locale: Locale,
): string => {
    if (!isChampion(recipient)) return finishText(recipient, ranksByAveragePlace, locale)
    return shared
        ? m.email_tournament_results_shared_champion({}, { locale })
        : m.email_tournament_results_champion({}, { locale })
}

export const TournamentResults = ({
    tournamentName,
    title,
    winners,
    standings,
    tiebreakRule,
    ranksByAveragePlace = false,
    url = ``,
    locale,
}: TournamentResultsProps) => {
    const shared = winners.length > 1
    const finish = {
        tournament: tournamentName,
        names: formatNames(winners, m.email_standings_nobody({}, { locale }), locale),
    }
    const recipient = standings.find((row) => row.recipient)
    return (
        <DarkCardEmail
            locale={locale}
            preview={
                shared
                    ? m.email_tournament_results_preview_share(finish, { locale })
                    : m.email_tournament_results_preview_takes(finish, { locale })
            }
            wordmarkHref={url}
            eyebrow={m.email_tournament_results_eyebrow({}, { locale })}
            heading={tournamentName}
            subline={m.email_tournament_results_subline(
                { title, count: standings.length },
                { locale },
            )}
            footer={
                <>
                    {m.email_tournament_results_footer({}, { locale })}{' '}
                    <ButtonFallback url={url} locale={locale} />
                </>
            }
        >
            <ChampionPanel winners={winners} locale={locale}>
                {recipient && recipientText(recipient, shared, ranksByAveragePlace, locale)}
            </ChampionPanel>
            <StandingsTable
                label={m.email_tournament_results_standings({}, { locale })}
                rows={standings}
                tiebreakRule={tiebreakRule}
                ranksByAveragePlace={ranksByAveragePlace}
                locale={locale}
            />
            <CardButton href={url}>{m.email_tournament_results_button({}, { locale })}</CardButton>
        </DarkCardEmail>
    )
}

TournamentResults.PreviewProps = {
    tournamentName: 'Fresh Fish Autumn Mini',
    title: 'Fresh Fish',
    winners: ['Alice'],
    standings: [
        { rank: 1, name: 'Alice', wins: 3, score: 2.5, tiebreak: '-0.99', recipient: false },
        { rank: 2, name: 'Bob', wins: 3, score: 2.5, tiebreak: '-1.775', recipient: true },
        { rank: 3, name: 'Carol', wins: 1, score: 1, tiebreak: '-4.265', recipient: false },
        { rank: 4, name: 'Dave', wins: 0, score: 0, tiebreak: '-9.332', recipient: false },
    ],
    tiebreakRule: 'pointsBehind',
    url: 'https://boardtogether.games/tournaments/fresh-fish-autumn-mini',
    locale: baseLocale,
} satisfies TournamentResultsProps

export default TournamentResults
