import { Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { AccountChangeType } from '@tabletop/common'
import { DarkCardEmail, darkStyles } from '../components/darkCard.js'

export { AccountChangeType } from '@tabletop/common'

interface AccountChangeNotificationProps {
    changeType: string
    timestamp: Date
    username?: string
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
    username,
}: AccountChangeNotificationProps) => {
    const when = formatTimestamp(timestamp)
    if (changeType === AccountChangeType.Username) {
        return (
            <DarkCardEmail
                preview={`Your username is now ${username}`}
                heading="Your username was changed"
                subline="An administrator changed your username. Use the new one to sign in."
                footer="If you have questions about this change, please contact us."
            >
                <Section style={styles.panel}>
                    <Text style={styles.panelValue}>{username}</Text>
                    <Text style={styles.panelDetail}>{when}</Text>
                </Section>
            </DarkCardEmail>
        )
    }
    let change = ''
    let detailText = ''
    switch (changeType) {
        case AccountChangeType.EmailChangeRequested:
            change =
                'A request was made to change your email address; your current address remains active until the new address is verified'
            detailText = 'Email address change requested'
            break
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
