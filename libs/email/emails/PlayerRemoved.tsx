import { Section, Text } from '@react-email/components'
import { STALLED_GAME_END_DAYS } from '@tabletop/common'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'

interface PlayerRemovedProps {
    playerName: string
    title: string
    gameName: string
    url?: string
    deletedAccount: boolean
}

export const PlayerRemoved = ({
    playerName,
    title,
    gameName,
    url = ``,
    deletedAccount,
}: PlayerRemovedProps) => {
    const departure = deletedAccount ? 'left' : 'was removed from'
    return (
        <DarkCardEmail
            preview={`${playerName} ${departure} your ${title} game ${gameName}.`}
            wordmarkHref={url}
            heading={gameName}
            subline={`${playerName} ${departure} Board Together. Your game of ${title} continues, but it will stop on their turn because nobody can move for them.`}
            footer={
                <>
                    You are playing in this game on Board Together. <ButtonFallback url={url} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>You can end the game early</Text>
                <Text style={styles.panelDetail}>
                    Open the game and choose Call the game from the account menu. A majority of the
                    players must agree. Otherwise it ends with no winner after{' '}
                    {STALLED_GAME_END_DAYS} days without a move.
                </Text>
            </Section>
            <CardButton href={url}>Open the game</CardButton>
        </DarkCardEmail>
    )
}

PlayerRemoved.PreviewProps = {
    playerName: 'Riley',
    title: 'Fresh Fish',
    gameName: 'Thursday night fish',
    url: 'https://boardtogether.games/game/abc',
    deletedAccount: false,
} satisfies PlayerRemovedProps

export default PlayerRemoved
