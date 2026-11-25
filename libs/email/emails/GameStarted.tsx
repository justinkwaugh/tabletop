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
import { RichMessage } from '../components/richMessage.js'
import { baseLocale, m, type Locale } from '../i18n.js'

export interface GameStartedProps {
    title: string
    gameName: string
    playerNames: string[]
    yourTurn: boolean
    activePlayerNames: string[]
    turnNotificationsOn: boolean
    url?: string
    notificationsUrl?: string
    locale: Locale
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

const activeNames = (activePlayerNames: string[], locale: Locale): string =>
    formatNames(activePlayerNames, m.email_game_started_no_active_names({}, { locale }), locale)

const turnText = (yourTurn: boolean, activePlayerNames: string[], locale: Locale): string =>
    yourTurn
        ? m.email_game_started_your_turn({}, { locale })
        : m.email_game_started_waiting(
              { names: activeNames(activePlayerNames, locale) },
              { locale },
          )

const previewText = (
    gameName: string,
    yourTurn: boolean,
    activePlayerNames: string[],
    turnNotificationsOn: boolean,
    locale: Locale,
): string => {
    if (!turnNotificationsOn)
        return m.email_game_started_preview_notifications_off({ game: gameName }, { locale })
    return yourTurn
        ? m.email_game_started_preview_your_turn({ game: gameName }, { locale })
        : m.email_game_started_preview_waiting(
              { game: gameName, names: activeNames(activePlayerNames, locale) },
              { locale },
          )
}

export const GameStarted = ({
    title,
    gameName,
    playerNames,
    yourTurn,
    activePlayerNames,
    turnNotificationsOn,
    url = ``,
    notificationsUrl = ``,
    locale,
}: GameStartedProps) => {
    return (
        <DarkCardEmail
            locale={locale}
            preview={previewText(
                gameName,
                yourTurn,
                activePlayerNames,
                turnNotificationsOn,
                locale,
            )}
            wordmarkHref={url}
            eyebrow={m.email_game_started_eyebrow({}, { locale })}
            heading={gameName}
            subline={
                <RichMessage
                    parts={m.email_game_started_subline.parts({ title }, { locale })}
                    markup={{
                        title: (text) => (
                            <span style={{ color: darkPalette.blue, fontWeight: 600 }}>{text}</span>
                        ),
                    }}
                />
            }
            footer={
                <>
                    {m.email_game_started_footer({}, { locale })}{' '}
                    <ButtonFallback
                        url={turnNotificationsOn ? url : notificationsUrl}
                        locale={locale}
                    />
                </>
            }
        >
            {!turnNotificationsOn && (
                <Section style={warning.panel}>
                    <Text style={warning.heading}>
                        {m.email_game_started_warning_heading({}, { locale })}
                    </Text>
                    <Text style={warning.body}>
                        {m.email_game_started_warning_body({}, { locale })}
                    </Text>
                    <Section style={warning.buttonRow}>
                        <Button href={notificationsUrl} style={warning.button}>
                            {m.email_game_started_warning_button({}, { locale })}
                        </Button>
                    </Section>
                </Section>
            )}
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>
                    {turnText(yourTurn, activePlayerNames, locale)}
                </Text>
                <Text style={styles.panelDetail}>
                    {formatNames(
                        playerNames,
                        m.email_game_started_no_players({}, { locale }),
                        locale,
                    )}
                </Text>
            </Section>
            {turnNotificationsOn ? (
                <>
                    <CardButton href={url}>{m.email_open_game({}, { locale })}</CardButton>
                    <Text style={turnSetUpNote}>
                        {m.email_game_started_turns_set_up({}, { locale })}
                    </Text>
                </>
            ) : (
                <Section style={styles.buttonRow}>
                    <Button href={url} style={secondaryButton}>
                        {m.email_open_game({}, { locale })}
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
    locale: baseLocale,
} satisfies GameStartedProps

export default GameStarted
