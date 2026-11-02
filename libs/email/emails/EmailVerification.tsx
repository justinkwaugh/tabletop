import { Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { DarkCardEmail, darkPalette, darkStyles } from '../components/darkCard.js'

interface EmailVerificationProps {
    token?: string
    expiresInMinutes?: number
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

export const EmailVerification = ({
    token = '',
    expiresInMinutes = 15,
}: EmailVerificationProps) => (
    <DarkCardEmail
        preview={`Your email verification code is ${token}`}
        heading="Confirm your email address"
        subline="Enter this code where you requested it to verify this email address."
        footer="If you did not request this, you can safely ignore this email."
    >
        <Section style={{ ...styles.panel, textAlign: 'center' }}>
            <Text style={styles.code}>{token}</Text>
            <Text style={styles.panelDetail}>
                This code stops working {expiresInMinutes} minutes after it was requested, and only
                the most recent code works.
            </Text>
        </Section>
    </DarkCardEmail>
)

EmailVerification.PreviewProps = {
    token: 'DJZTLX',
    expiresInMinutes: 15,
} satisfies EmailVerificationProps

export default EmailVerification
