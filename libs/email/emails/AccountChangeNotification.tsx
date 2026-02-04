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

interface AccountChangeNotificationProps {
    changeType: string
    timestamp: Date
}

// I don't want to redefine this here, but I wasn't sure of a good place to put it
export enum AccountChangeType {
    Email = 'email',
    Password = 'password',
    PasswordReset = 'passwordReset',
}

export const AccountChangeNotification = ({
    timestamp,
    changeType,
}: AccountChangeNotificationProps) => {
    let previewText = ''
    let mainText = ''
    let detailText = ''
    switch (changeType) {
        case AccountChangeType.PasswordReset:
            previewText =
                'A request was made to reset the password for your account at ' + timestamp
            mainText = 'A request was made to reset the password for your account'
            detailText = 'Password reset requested'
            break
        case AccountChangeType.Email:
            previewText = 'Your email address was changed at ' + timestamp
            mainText = 'Your email address was changed'
            detailText = 'Email address changed'
            break
        case AccountChangeType.Password:
            previewText = 'Your password was changed at ' + timestamp
            mainText = 'Your password was changed'
            detailText = 'Password changed'
            break
    }

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-[#f3f4f6] my-0 mx-auto font-sans">
                    <Container className="my-[32px] mx-auto p-[24px] bg-white border border-[#e5e7eb]">
                        <Section className="mb-[16px]">
                            <Text className="text-[12px] uppercase tracking-[1.5px] text-[#6b7280] m-0">
                                Security Notice
                            </Text>
                            <Heading className="text-[#0f172a] my-[8px] mx-0 text-[28px] p-0 leading-[1.2]">
                                Account change detected
                            </Heading>
                            <Text className="text-[#475569] text-[15px] leading-[1.6] m-0">
                                {mainText}
                            </Text>
                        </Section>

                        <Section className="bg-[#f8fafc] border border-[#e2e8f0] px-[16px] py-[14px] mb-[18px]">
                            <Text className="text-[13px] uppercase tracking-[1px] text-[#64748b] m-0">
                                Details
                            </Text>
                            <Text className="text-[#0f172a] text-[16px] font-semibold m-0">
                                {detailText}
                            </Text>
                            <Text className="text-[#475569] text-[13px] m-0">
                                {timestamp.toLocaleDateString()} at{' '}
                                {timestamp.toLocaleTimeString()}
                            </Text>
                        </Section>

                        <Section className="bg-[#fef2f2] border border-[#fecaca] px-[16px] py-[12px] mb-[16px]">
                            <Text className="text-[#991b1b] text-[13px] m-0">
                                If you did not make this change, please contact us immediately.
                            </Text>
                        </Section>

                        <Text className="text-[#9ca3af] text-[12px] leading-[1.6] m-0">
                            If you made the change described above, you can safely ignore this
                            email.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

AccountChangeNotification.PreviewProps = {
    changeType: AccountChangeType.PasswordReset,
    timestamp: new Date(),
} as AccountChangeNotificationProps

export default AccountChangeNotification
