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

interface PasswordResetProps {
    token?: string
    url?: string
}

export const PasswordReset = ({ url = `` }: PasswordResetProps) => {
    const previewText = `Please goto ${url} to reset your password`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-0 mx-auto font-sans">
                    <Container className="my-0 mx-auto p-[20px]">
                        <Heading className="text-[#1d1c1d] my-[30px] mx-0 text-[36px] p-0">
                            Password Reset Request
                        </Heading>
                        <Text>Please follow the link below to reset your password</Text>
                        <Section className="bg-[#f5f4f5] mb-[30px] py-[40px] px-[10px] text-center">
                            <Link href={url}>Password Reset Link</Link>
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

PasswordReset.PreviewProps = {
    url: '#',
} as PasswordResetProps

export default PasswordReset
