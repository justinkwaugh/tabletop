import { GameVisibility, type GameMetadata } from '../game/definition/gameMetadata.js'
import { Role } from './user.js'

export function getTitleVisibility(metadata: GameMetadata): GameVisibility {
    return metadata.visibility ?? (metadata.beta ? GameVisibility.Beta : GameVisibility.Public)
}

export function canDiscoverTitle(metadata: GameMetadata, roles: readonly Role[]): boolean {
    if (roles.includes(Role.Admin)) return true
    switch (getTitleVisibility(metadata)) {
        case GameVisibility.Alpha:
            return roles.includes(Role.AlphaTester) || roles.includes(Role.Developer)
        case GameVisibility.Beta:
            return roles.includes(Role.BetaTester) || roles.includes(Role.Developer)
        case GameVisibility.Public:
            return true
    }
}
