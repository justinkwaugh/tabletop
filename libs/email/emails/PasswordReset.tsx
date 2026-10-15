import { ButtonFallback, CardButton, DarkCardEmail } from '../components/darkCard.js'

interface PasswordResetProps {
    token?: string
    url?: string
}

export const PasswordReset = ({ url = `` }: PasswordResetProps) => (
    <DarkCardEmail
        preview="Reset your password"
        heading="Reset your password"
        subline="Click the button below to choose a new password. This link will expire shortly."
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
    url: 'https://boardtogether.games/reset-password?token=abc123',
} satisfies PasswordResetProps

export default PasswordReset
