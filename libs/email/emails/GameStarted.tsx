import { Button, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkPalette,
    darkStyles as styles,
    formatNames,
} from '../components/darkCard.js'

export interface GameStartedProps {
    title: string
    gameName: string
    playerNames: string[]
    yourTurn: boolean
    activePlayerNames: string[]
    turnNotificationsOn: boolean
    url?: string
    notificationsUrl?: string
}

const warning = {
    panel: {
        ...styles.panel,
        backgroundColor: darkPalette.warningSurface,
        border: `1px solid ${darkPalette.gold}`,
    },
    heading: {
        margin: 0,
        fontSize: '18px',
        lineHeight: '1.3',
        fontWeight: 700,
        color: darkPalette.gold,
    },
    body: { margin: '6px 0 0', fontSize: '14px', lineHeight: '1.55', color: darkPalette.bodyText },
    buttonRow: { textAlign: 'left', padding: '16px 0 0' },
    button: {
        ...styles.button,
        backgroundColor: darkPalette.gold,
        border: `1px solid ${darkPalette.gold}`,
        color: darkPalette.card,
        fontWeight: 700,
    },
} satisfies Record<string, CSSProperties>

const secondaryButton = {
    ...styles.button,
    backgroundColor: 'transparent',
    color: darkPalette.blue,
    padding: '12px 22px',
} satisfies CSSProperties

const turnSetUpNote = {
    ...styles.footer,
    textAlign: 'center',
} satisfies CSSProperties

const turnText = (yourTurn: boolean, activePlayerNames: string[]): string =>
    yourTurn
        ? "It's your turn"
        : `Waiting for ${formatNames(activePlayerNames, 'the other players')}`

export const GameStarted = ({
    title,
    gameName,
    playerNames,
    yourTurn,
    activePlayerNames,
    turnNotificationsOn,
    url = ``,
    notificationsUrl = ``,
}: GameStartedProps) => {
    const turn = turnText(yourTurn, activePlayerNames)
    const preview = turnNotificationsOn
        ? `${gameName} has started. ${turn}.`
        : `${gameName} has started. Turn on turn notifications so you know when to move.`
    return (
        <DarkCardEmail
            preview={preview}
            wordmarkHref={url}
            eyebrow="Game started"
            heading={gameName}
            subline={
                <>
                    Your game of{' '}
                    <span style={{ color: darkPalette.blue, fontWeight: 600 }}>{title}</span> has
                    started.
                </>
            }
            footer={
                <>
                    You're playing in this game on Board Together. You can turn off game emails on
                    your notifications page.{' '}
                    <ButtonFallback url={turnNotificationsOn ? url : notificationsUrl} />
                </>
            }
        >
            {!turnNotificationsOn && (
                <Section style={warning.panel}>
                    <Text style={warning.heading}>You won't hear when it's your turn</Text>
                    <Text style={warning.body}>
                        Board Together never emails you about turns. It tells you through your
                        browser or Discord, and you have neither turned on.
                    </Text>
                    <Section style={warning.buttonRow}>
                        <Button href={notificationsUrl} style={warning.button}>
                            Turn on turn notifications
                        </Button>
                    </Section>
                </Section>
            )}
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>{turn}</Text>
                <Text style={styles.panelDetail}>{formatNames(playerNames, 'No players')}</Text>
            </Section>
            {turnNotificationsOn ? (
                <>
                    <CardButton href={url}>Open the game</CardButton>
                    <Text style={turnSetUpNote}>
                        We'll tell you about your turns through your browser or Discord.
                    </Text>
                </>
            ) : (
                <Section style={styles.buttonRow}>
                    <Button href={url} style={secondaryButton}>
                        Open the game
                    </Button>
                </Section>
            )}
        </DarkCardEmail>
    )
}

GameStarted.PreviewProps = {
    title: '1828: The Birth of the American Railway System',
    gameName: 'Beta 2',
    playerNames: ['tyjo99', 'jellyfishjoe', 'Beezy', 'joeD', 'NicoSfera'],
    yourTurn: true,
    activePlayerNames: ['tyjo99'],
    turnNotificationsOn: false,
    url: 'https://boardtogether.games/game/qidEk1NjzIRBEioOpoCGD',
    notificationsUrl: 'https://boardtogether.games/notifications',
} satisfies GameStartedProps

export default GameStarted
