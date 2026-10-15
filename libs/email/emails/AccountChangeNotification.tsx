import { Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { DarkCardEmail, darkStyles } from '../components/darkCard.js'

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

const styles = {
    ...darkStyles,
    warning: {
        marginTop: '16px',
        backgroundColor: '#3b1f24',
        border: '1px solid #f8717166',
        borderRadius: '10px',
        padding: '14px 20px',
    },
    warningText: { margin: 0, fontSize: '14px', lineHeight: '1.5', color: '#fca5a5' },
} satisfies Record<string, CSSProperties>

// The server runs in UTC and an email cannot know the reader's time zone, so say UTC outright.
const formatTimestamp = (timestamp: Date): string =>
    `${timestamp.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })} UTC`

export const AccountChangeNotification = ({
    timestamp,
    changeType,
}: AccountChangeNotificationProps) => {
    const when = formatTimestamp(timestamp)
    let change = ''
    let detailText = ''
    switch (changeType) {
        case AccountChangeType.PasswordReset:
            change = 'A request was made to reset the password for your account'
            detailText = 'Password reset requested'
            break
        case AccountChangeType.Email:
            change = 'Your email address was changed'
            detailText = 'Email address changed'
            break
        case AccountChangeType.Password:
            change = 'Your password was changed'
            detailText = 'Password changed'
            break
    }

    return (
        <DarkCardEmail
            preview={`${change} on ${when}`}
            heading="Account change detected"
            subline={`${change}.`}
            footer="If you made the change described above, you can safely ignore this email."
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>{detailText}</Text>
                <Text style={styles.panelDetail}>{when}</Text>
            </Section>
            <Section style={styles.warning}>
                <Text style={styles.warningText}>
                    If you did not make this change, please contact us immediately.
                </Text>
            </Section>
        </DarkCardEmail>
    )
}

AccountChangeNotification.PreviewProps = {
    changeType: AccountChangeType.PasswordReset,
    timestamp: new Date(),
} satisfies AccountChangeNotificationProps

export default AccountChangeNotification
