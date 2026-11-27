import { ExternalAuthService } from '@tabletop/common'
import googleLogo from './images/google.jpg'
import discordLogo from './images/discord.png'

export type LinkableService = ExternalAuthService.Google | ExternalAuthService.Discord

export const LINKABLE_SERVICES: readonly LinkableService[] = [
    ExternalAuthService.Google,
    ExternalAuthService.Discord
]

export const LINKABLE_SERVICE_DISPLAY: Record<LinkableService, { label: string; logo: string }> = {
    [ExternalAuthService.Google]: { label: 'Google', logo: googleLogo },
    [ExternalAuthService.Discord]: { label: 'Discord', logo: discordLogo }
}
