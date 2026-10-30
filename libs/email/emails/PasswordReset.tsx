import { ButtonFallback, CardButton, DarkCardEmail } from '../components/darkCard.js'

interface PasswordResetProps {
    url?: string
    expiresInMinutes?: number
}

export const PasswordReset = ({ url = ``, expiresInMinutes = 15 }: PasswordResetProps) => (
    <DarkCardEmail
        preview="Reset your password"
        heading="Reset your password"
        subline={`Click the button below to choose a new password. The link stops working ${expiresInMinutes} minutes after it was requested, and only the most recent link works.`}
        footer={
            <>
                If you did not request a password reset, you can safely ignore this email.{' '}
                <ButtonFallback url={url} />
            </>
        }
    >
        <CardButton href={url}>Reset password</CardButton>
    </DarkCardEmail>
)

PasswordReset.PreviewProps = {
    url: 'https://boardtogether.games/email/passwordReset/account.secret',
    expiresInMinutes: 15,
} satisfies PasswordResetProps

export default PasswordReset
