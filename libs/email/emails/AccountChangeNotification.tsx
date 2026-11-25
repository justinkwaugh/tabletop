import { Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { AccountChangeType, assertExists } from '@tabletop/common'
import { DarkCardEmail, darkStyles } from '../components/darkCard.js'
import { formatEmailTimestamp } from '../components/format.js'
import { baseLocale, m, type Locale, type Message } from '../i18n.js'

export { AccountChangeType } from '@tabletop/common'

interface AccountChangeNotificationProps {
    changeType: AccountChangeType
    timestamp: Date
    username?: string
    locale: Locale
    timeZone?: string
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

type ReportedChange = Exclude<
    AccountChangeType,
    AccountChangeType.AccountDeleted | AccountChangeType.Username
>

const CHANGE_MESSAGES: Record<
    ReportedChange,
    {
        preview: Message<{ time: string }>
        subline: Message<object>
        detail: Message<object>
    }
> = {
    [AccountChangeType.EmailChangeRequested]: {
        preview: m.email_account_email_change_requested_preview,
        subline: m.email_account_email_change_requested_subline,
        detail: m.email_account_email_change_requested_detail,
    },
    [AccountChangeType.PasswordReset]: {
        preview: m.email_account_password_reset_requested_preview,
        subline: m.email_account_password_reset_requested_subline,
        detail: m.email_account_password_reset_requested_detail,
    },
    [AccountChangeType.Email]: {
        preview: m.email_account_email_changed_preview,
        subline: m.email_account_email_changed_subline,
        detail: m.email_account_email_changed_detail,
    },
    [AccountChangeType.Password]: {
        preview: m.email_account_password_changed_preview,
        subline: m.email_account_password_changed_subline,
        detail: m.email_account_password_changed_detail,
    },
}

export const AccountChangeNotification = ({
    timestamp,
    changeType,
    username,
    locale,
    timeZone,
}: AccountChangeNotificationProps) => {
    const when = formatEmailTimestamp(timestamp, locale, timeZone)
    if (changeType === AccountChangeType.AccountDeleted) {
        return (
            <DarkCardEmail
                locale={locale}
                preview={m.email_account_deleted_preview({}, { locale })}
                heading={m.email_account_deleted_heading({}, { locale })}
                subline={m.email_account_deleted_subline({}, { locale })}
                footer={m.email_account_deleted_footer({}, { locale })}
            >
                <Section style={styles.panel}>
                    <Text style={styles.panelValue}>
                        {m.email_account_deleted_detail({}, { locale })}
                    </Text>
                    <Text style={styles.panelDetail}>{when}</Text>
                </Section>
            </DarkCardEmail>
        )
    }
    if (changeType === AccountChangeType.Username) {
        assertExists(username, 'A username change email names the new username')
        return (
            <DarkCardEmail
                locale={locale}
                preview={m.email_username_changed_preview({ username }, { locale })}
                heading={m.email_username_changed_heading({}, { locale })}
                subline={m.email_username_changed_subline({}, { locale })}
                footer={m.email_username_changed_footer({}, { locale })}
            >
                <Section style={styles.panel}>
                    <Text style={styles.panelValue}>{username}</Text>
                    <Text style={styles.panelDetail}>{when}</Text>
                </Section>
            </DarkCardEmail>
        )
    }
    const change = CHANGE_MESSAGES[changeType]

    return (
        <DarkCardEmail
            locale={locale}
            preview={change.preview({ time: when }, { locale })}
            heading={m.email_account_change_heading({}, { locale })}
            subline={change.subline({}, { locale })}
            footer={m.email_account_change_footer({}, { locale })}
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>{change.detail({}, { locale })}</Text>
                <Text style={styles.panelDetail}>{when}</Text>
            </Section>
            <Section style={styles.warning}>
                <Text style={styles.warningText}>
                    {m.email_account_change_warning({}, { locale })}
                </Text>
            </Section>
        </DarkCardEmail>
    )
}

AccountChangeNotification.PreviewProps = {
    changeType: AccountChangeType.PasswordReset,
    timestamp: new Date(),
    locale: baseLocale,
} satisfies AccountChangeNotificationProps

export default AccountChangeNotification
