import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
    formatNames,
} from '../components/darkCard.js'

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
}: LeagueSeasonStartProps) => {
    const previewText = `${leagueName} Season ${seasonNumber} has started. You are in Group ${groupName}.`
    return (
        <DarkCardEmail
            preview={previewText}
            wordmarkHref={url}
            eyebrow={`Season ${seasonNumber} has started`}
            heading={leagueName}
            subline={`${title} · ${level ? `Level ${level.name}` : 'Seeding season'}`}
            footer={
                <>
                    You signed up for this league season on Board Together.{' '}
                    <ButtonFallback url={url} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>You are in Group {groupName}</Text>
                {level?.moved === 'up' && (
                    <Text style={styles.panelDetail}>
                        You moved up to Level {level.name} to fill a place left by players who did
                        not return this season.
                    </Text>
                )}
                {level?.moved === 'merged' && (
                    <Text style={styles.panelDetail}>
                        The league has fewer players this season, so its bottom level has joined
                        Level {level.name}.
                    </Text>
                )}
                {level?.moved === 'down' && (
                    <Text style={styles.panelDetail}>
                        The league has grown a new level this season, so the lowest finishers of the
                        level above, including you, start in Level {level.name}.
                    </Text>
                )}
                <Text style={styles.panelDetail}>
                    You play {gamesEach} games against {formatNames(opponents, 'your group')}.
                    {!level && ' Your results set your level for the next season.'}
                </Text>
            </Section>
            <CardButton href={url}>See your games</CardButton>
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
} satisfies LeagueSeasonStartProps

export default LeagueSeasonStart
