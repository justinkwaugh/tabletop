import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'
import { baseLocale, m, type Locale } from '../i18n.js'

interface GameInvitationProps {
    ownerName: string
    title: string
    gameName: string
    url: string
    locale: Locale
}

export const GameInvitation = ({
    ownerName,
    title,
    gameName,
    url,
    locale,
}: GameInvitationProps) => (
    <DarkCardEmail
        locale={locale}
        preview={m.email_game_invitation_preview({ owner: ownerName, title }, { locale })}
        wordmarkHref={url}
        heading={m.email_game_invitation_heading({ owner: ownerName }, { locale })}
        subline={m.email_game_invitation_subline({}, { locale })}
        footer={
            <>
                {m.email_game_invitation_footer({}, { locale })}{' '}
                <ButtonFallback url={url} locale={locale} />
            </>
        }
    >
        <Section style={styles.panel}>
            <Text style={styles.panelValue}>{gameName}</Text>
            <Text style={styles.panelDetail}>{title}</Text>
        </Section>
        <CardButton href={url}>{m.email_game_invitation_button({}, { locale })}</CardButton>
    </DarkCardEmail>
)

GameInvitation.PreviewProps = {
    ownerName: 'bobsmith27',
    title: 'Sol: Last Days of a Star',
    gameName: "Bob's Game of 4D Chess",
    url: 'https://boardtogether.games/game/qidEk1NjzIRBEioOpoCGD',
    locale: baseLocale,
} satisfies GameInvitationProps

export default GameInvitation
