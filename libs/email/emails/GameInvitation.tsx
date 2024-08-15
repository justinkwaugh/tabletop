import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components'

interface GameInvitationProps {
    ownerName: string
    title: string
    gameName: string
    token?: string
    url?: string
}

export const GameInvitation = ({ ownerName, title, gameName, url = `` }: GameInvitationProps) => {
    const previewText = `Please goto ${url} to reset your password`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-0 mx-auto font-sans">
                    <Container className="my-0 mx-auto p-[20px]">
                        <Heading className="text-[#1d1c1d] my-[30px] mx-0 text-[36px] p-0">
                            You've been invited to a game!
                        </Heading>
                        <Text>
                            <span className="text-[#666666]">{ownerName}</span> has invited you to a
                            game of {title}! Please follow the link below to join the game...
                        </Text>
                        <Section className="bg-[#f5f4f5] mb-[30px] py-[40px] px-[10px] text-center">
                            <Link href={url}>
                                {title} - {gameName}
                            </Link>
                        </Section>

                        <Text>
                            If you didn't request this email, there's nothing to worry about, you
                            can safely ignore it.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

GameInvitation.PreviewProps = {
    ownerName: 'bobsmith27',
    title: '4d chess',
    gameName: "Bob's Game of 4D Chess",
    url: '#',
} as GameInvitationProps

export default GameInvitation
