import { Section, Text } from '@react-email/components'
import { STALLED_GAME_END_DAYS } from '@tabletop/common'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'
import { baseLocale, m, type Locale } from '../i18n.js'

interface PlayerRemovedProps {
    playerName: string
    title: string
    gameName: string
    url?: string
    deletedAccount: boolean
    locale: Locale
}

export const PlayerRemoved = ({
    playerName,
    title,
    gameName,
    url = ``,
    deletedAccount,
    locale,
}: PlayerRemovedProps) => {
    const departure = { player: playerName, title, game: gameName }
    return (
        <DarkCardEmail
            locale={locale}
            preview={
                deletedAccount
                    ? m.email_player_removed_preview_left(departure, { locale })
                    : m.email_player_removed_preview_removed(departure, { locale })
            }
            wordmarkHref={url}
            heading={gameName}
            subline={
                deletedAccount
                    ? m.email_player_removed_subline_left(departure, { locale })
                    : m.email_player_removed_subline_removed(departure, { locale })
            }
            footer={
                <>
                    {m.email_player_removed_footer({}, { locale })}{' '}
                    <ButtonFallback url={url} locale={locale} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>
                    {m.email_player_removed_end_early({}, { locale })}
                </Text>
                <Text style={styles.panelDetail}>
                    {m.email_player_removed_end_early_detail(
                        { days: STALLED_GAME_END_DAYS },
                        { locale },
                    )}
                </Text>
            </Section>
            <CardButton href={url}>{m.email_open_game({}, { locale })}</CardButton>
        </DarkCardEmail>
    )
}

PlayerRemoved.PreviewProps = {
    playerName: 'Riley',
    title: 'Fresh Fish',
    gameName: 'Thursday night fish',
    url: 'https://boardtogether.games/game/abc',
    deletedAccount: false,
    locale: baseLocale,
} satisfies PlayerRemovedProps

export default PlayerRemoved
