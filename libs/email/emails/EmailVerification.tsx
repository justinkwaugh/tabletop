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
                <Body className="bg-[#f3f4f6] my-0 mx-auto font-sans">
                    <Container className="my-[32px] mx-auto p-[24px] bg-white border border-[#e5e7eb]">
                        <Section className="mb-[16px]">
                            <Text className="text-[12px] uppercase tracking-[1.5px] text-[#6b7280] m-0">
                                Email Verification
                            </Text>
                            <Heading className="text-[#0f172a] my-[8px] mx-0 text-[28px] p-0 leading-[1.2]">
                                Confirm your email address
                            </Heading>
                            <Text className="text-[#475569] text-[15px] leading-[1.6] m-0">
                                Enter this code in the verification screen to finish signing in.
                            </Text>
                        </Section>

                        <Section className="bg-[#f8fafc] border border-[#e2e8f0] py-[18px] text-center mb-[20px]">
                            <Text className="text-[24px] tracking-[4px] font-semibold m-0 text-[#0f172a]">
                                {token}
                            </Text>
                            <Text className="text-[12px] text-[#64748b] m-0 mt-[6px]">
                                This code expires soon.
                            </Text>
                        </Section>

                        <Text className="text-[#9ca3af] text-[12px] leading-[1.6] m-0">
                            If you did not request this, you can safely ignore this email.
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
