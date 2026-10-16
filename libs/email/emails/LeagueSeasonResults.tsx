import { ButtonFallback, CardButton, DarkCardEmail } from '../components/darkCard.js'
import {
    ChampionPanel,
    ordinal,
    ResultPanel,
    StandingsTable,
    type StandingsRow,
} from '../components/standings.js'

export interface LeagueSeasonResultsProps {
    leagueName: string
    title: string
    seasonNumber: number
    groupName: string
    place: number
    movement: 'promoted' | 'relegated' | 'stayed' | 'seeded'
    nextLevel: string
    champion?: string
    standings: StandingsRow[]
    url?: string
}

const resultText = ({
    seasonNumber,
    groupName,
    place,
    movement,
    nextLevel,
}: LeagueSeasonResultsProps): string => {
    const finished = `You finished ${ordinal(place)} in Group ${groupName}`
    switch (movement) {
        case 'seeded':
            return `${finished}. Your Season ${seasonNumber + 1} place is in Level ${nextLevel}.`
        case 'promoted':
            return `${finished} and move up to Level ${nextLevel}.`
        case 'relegated':
            return `${finished} and move down to Level ${nextLevel}.`
        case 'stayed':
            return `${finished} and stay in Level ${nextLevel}.`
    }
}

export const leagueSeasonResultsName = ({
    movement,
    seasonNumber,
}: Pick<LeagueSeasonResultsProps, 'movement' | 'seasonNumber'>): string =>
    movement === 'seeded' ? 'Seeding season' : `Season ${seasonNumber}`

export const LeagueSeasonResults = (props: LeagueSeasonResultsProps) => {
    const { leagueName, title, groupName, champion, standings, url = `` } = props
    const result = resultText(props)
    const season = leagueSeasonResultsName(props)
    return (
        <DarkCardEmail
            preview={`${leagueName} ${season} is complete. ${result}`}
            wordmarkHref={url}
            eyebrow={`${season} complete`}
            heading={leagueName}
            subline={`${title} · Group ${groupName}`}
            footer={
                <>
                    You played in this league season on Board Together. <ButtonFallback url={url} />
                </>
            }
        >
            {champion ? (
                <ChampionPanel winners={[champion]}>{result}</ChampionPanel>
            ) : (
                <ResultPanel>{result}</ResultPanel>
            )}
            <StandingsTable
                label={`Group ${groupName} final standings`}
                rows={standings}
                starWinner={false}
            />
            <CardButton href={url}>See the season results</CardButton>
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
        { rank: 1, name: 'Bob', wins: 3, score: 3, tiebreak: 140, recipient: true },
        { rank: 2, name: 'Carol', wins: 2, score: 2, tiebreak: 131, recipient: false },
        { rank: 3, name: 'Dave', wins: 1, score: 1, tiebreak: 122, recipient: false },
        { rank: 4, name: 'Erin', wins: 1, score: 1, tiebreak: 101, recipient: false },
    ],
    url: 'https://boardtogether.games/leagues/fresh-fish-league?season=2',
} satisfies LeagueSeasonResultsProps

export default LeagueSeasonResults
