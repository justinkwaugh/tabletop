import { ButtonFallback, CardButton, DarkCardEmail } from '../components/darkCard.js'
import { baseLocale, m, type Locale } from '../i18n.js'

interface PasswordResetProps {
    url: string
    expiresInMinutes: number
    locale: Locale
}

export const PasswordReset = ({ url, expiresInMinutes, locale }: PasswordResetProps) => (
    <DarkCardEmail
        locale={locale}
        preview={m.email_password_reset_heading({}, { locale })}
        heading={m.email_password_reset_heading({}, { locale })}
        subline={m.email_password_reset_subline({ minutes: expiresInMinutes }, { locale })}
        footer={
            <>
                {m.email_password_reset_footer({}, { locale })}{' '}
                <ButtonFallback url={url} locale={locale} />
            </>
        }
    >
        <CardButton href={url}>{m.email_password_reset_button({}, { locale })}</CardButton>
    </DarkCardEmail>
)

PasswordReset.PreviewProps = {
    url: 'https://boardtogether.games/email/passwordReset/account.secret',
    expiresInMinutes: 15,
    locale: baseLocale,
} satisfies PasswordResetProps

export default PasswordReset
