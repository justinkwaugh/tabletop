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
    switch (changeType) {
        case AccountChangeType.PasswordReset:
            previewText =
                'A request was made to reset the password for your account at ' + timestamp
            mainText = 'A request was made to reset the password for your account'
            break
        case AccountChangeType.Email:
            previewText = 'Your email address was changed at ' + timestamp
            mainText = 'Your email address was changed'
            break
        case AccountChangeType.Password:
            previewText = 'Your password was changed at ' + timestamp
            mainText = 'Your password was changed'
            break
    }

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-0 mx-auto font-sans">
                    <Container className="my-0 mx-auto p-[20px]">
                        <Heading className="text-[#1d1c1d] my-[30px] mx-0 text-[36px] p-0">
                            Account Change Notification
                        </Heading>
                        <Text>
                            This is a security notification to inform you of a change to sensitive
                            information on your account.
                        </Text>
                        <Section className="bg-[#f5f5f5] mb-[30px] py-[40px] px-[10px] text-center">
                            <Text>
                                <span className="text-lg">{mainText}</span>
                                <br />
                                at{' '}
                                <span className="text-blue-700">
                                    {timestamp.toLocaleTimeString()}
                                </span>{' '}
                                on{' '}
                                <span className="text-blue-700">
                                    {timestamp.toLocaleDateString()}
                                </span>
                            </Text>
                            <Text className="text-red-700">
                                If you did not make this change, please contact us immediately.
                            </Text>
                        </Section>
                        <Text>
                            If you made the change described above, there is nothing to worry about
                            and you can safely ignore it.
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
