import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'

interface GameInvitationProps {
    ownerName: string
    title: string
    gameName: string
    token?: string
    url?: string
}

export const GameInvitation = ({ ownerName, title, gameName, url = `` }: GameInvitationProps) => (
    <DarkCardEmail
        preview={`Join ${ownerName}'s game of ${title}`}
        wordmarkHref={url}
        heading={`${ownerName} invited you to play`}
        subline="Accept the invite to join the table. Your seat is waiting."
        footer={
            <>
                If you did not expect this invite, you can safely ignore this email.{' '}
                <ButtonFallback url={url} />
            </>
        }
    >
        <Section style={styles.panel}>
            <Text style={styles.panelValue}>{gameName}</Text>
            <Text style={styles.panelDetail}>{title}</Text>
        </Section>
        <CardButton href={url}>Join the game</CardButton>
    </DarkCardEmail>
)

GameInvitation.PreviewProps = {
    ownerName: 'bobsmith27',
    title: 'Sol: Last Days of a Star',
    gameName: "Bob's Game of 4D Chess",
    url: 'https://boardtogether.games/game/qidEk1NjzIRBEioOpoCGD',
} satisfies GameInvitationProps

export default GameInvitation
