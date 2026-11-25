import { Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { DarkCardEmail, darkPalette, darkStyles } from '../components/darkCard.js'
import { baseLocale, m, type Locale } from '../i18n.js'

interface EmailVerificationProps {
    token: string
    expiresInMinutes: number
    locale: Locale
}

const styles = {
    ...darkStyles,
    code: {
        margin: 0,
        fontSize: '30px',
        lineHeight: '1.2',
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: darkPalette.text,
    },
} satisfies Record<string, CSSProperties>

export const EmailVerification = ({ token, expiresInMinutes, locale }: EmailVerificationProps) => (
    <DarkCardEmail
        locale={locale}
        preview={m.email_verification_preview({ code: token }, { locale })}
        heading={m.email_verification_heading({}, { locale })}
        subline={m.email_verification_subline({}, { locale })}
        footer={m.email_verification_footer({}, { locale })}
    >
        <Section style={{ ...styles.panel, textAlign: 'center' }}>
            <Text style={styles.code}>{token}</Text>
            <Text style={styles.panelDetail}>
                {m.email_verification_expiry({ minutes: expiresInMinutes }, { locale })}
            </Text>
        </Section>
    </DarkCardEmail>
)

EmailVerification.PreviewProps = {
    token: 'DJZTLX',
    expiresInMinutes: 15,
    locale: baseLocale,
} satisfies EmailVerificationProps

export default EmailVerification
