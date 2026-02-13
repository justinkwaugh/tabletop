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
    const previewText = `Reset your password`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-[#f3f4f6] my-0 mx-auto font-sans">
                    <Container className="my-[32px] mx-auto p-[24px] bg-white border border-[#e5e7eb]">
                        <Section className="mb-[16px]">
                            <Text className="text-[12px] uppercase tracking-[1.5px] text-[#6b7280] m-0">
                                Password Reset
                            </Text>
                            <Heading className="text-[#0f172a] my-[8px] mx-0 text-[28px] p-0 leading-[1.2]">
                                Reset your password
                            </Heading>
                            <Text className="text-[#475569] text-[15px] leading-[1.6] m-0">
                                Click the button below to choose a new password. This link will
                                expire shortly.
                            </Text>
                        </Section>

                        <Section className="text-center mb-[16px]">
                            <Link
                                href={url}
                                className="bg-[#0f172a] text-white no-underline px-[18px] py-[12px] rounded-[6px] inline-block text-[14px]"
                            >
                                Reset password
                            </Link>
                        </Section>

                        <Text className="text-[#64748b] text-[12px] leading-[1.6] m-0">
                            If the button does not work, copy and paste this link into your
                            browser: <span className="text-[#0f172a]">{url}</span>
                        </Text>

                        <Text className="text-[#9ca3af] text-[12px] leading-[1.6] mt-[16px] mb-0">
                            If you did not request a password reset, you can safely ignore this
                            email.
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
