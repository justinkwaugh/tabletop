import { ButtonFallback, CardButton, DarkCardEmail, formatNames } from '../components/darkCard.js'
import {
    ChampionPanel,
    isChampion,
    ordinal,
    StandingsTable,
    type StandingsRow,
} from '../components/standings.js'

interface TournamentResultsProps {
    tournamentName: string
    title: string
    winners: string[]
    standings: StandingsRow[]
    url?: string
}

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
    const recipient = standings.find((row) => row.recipient)
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
            <ChampionPanel winners={winners}>
                {recipient &&
                    (isChampion(recipient)
                        ? shared
                            ? 'You share the top of the table. Congratulations!'
                            : 'That is you. Congratulations!'
                        : `You finished ${ordinal(recipient.rank)} with ${recipient.wins} ${recipient.wins === 1 ? 'win' : 'wins'}.`)}
            </ChampionPanel>
            <StandingsTable label="Final standings" rows={standings} />
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
