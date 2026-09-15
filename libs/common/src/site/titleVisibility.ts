import { GameVisibility, type GameMetadata } from '../game/definition/gameMetadata.js'
import { Role } from './user.js'

export function getTitleVisibility(metadata: GameMetadata): GameVisibility {
    return metadata.visibility ?? (metadata.beta ? GameVisibility.Beta : GameVisibility.Public)
}

export function canDiscoverTitle(metadata: GameMetadata, roles: readonly Role[]): boolean {
    if (roles.includes(Role.Admin)) return true
    switch (getTitleVisibility(metadata)) {
        case GameVisibility.Alpha:
            return roles.includes(Role.AlphaTester)
        case GameVisibility.Beta:
            return roles.includes(Role.BetaTester)
        case GameVisibility.Public:
            return true
    }
}
