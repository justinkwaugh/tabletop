import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components'

interface EmailVerificationProps {
    token?: string
    url?: string
}

export const EmailVerification = ({ token = '' }: EmailVerificationProps) => {
    const previewText = `Your email verification code is ${token}`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-0 mx-auto font-sans">
                    <Container className="my-0 mx-auto p-[20px]">
                        <Heading className="text-[#1d1c1d] my-[30px] mx-0 text-[36px] p-0">
                            Confirm your email address
                        </Heading>
                        <Text>
                            Your confirmation code is below - enter it in your open browser window
                            and we'll help you get signed in.
                        </Text>
                        <Section className="bg-[#f5f4f5] mb-[30px] py-[40px] px-[10px] text-center">
                            <Text className="text-3xl">{token}</Text>
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

EmailVerification.PreviewProps = {
    token: 'DJZ-TLX',
} as EmailVerificationProps

export default EmailVerification
