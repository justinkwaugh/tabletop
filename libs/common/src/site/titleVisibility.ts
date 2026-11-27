import { GameVisibility, type GameMetadata } from '../game/definition/gameMetadata.js'
import { Role } from './user.js'

export enum TitleMaturity {
    Released = 'released',
    Beta = 'beta',
    Alpha = 'alpha'
}

export function getCatalogVisibility(metadata: GameMetadata): GameVisibility {
    return metadata.visibility ?? (metadata.beta ? GameVisibility.Beta : GameVisibility.Public)
}

export function getTitleMaturity(metadata: GameMetadata): TitleMaturity {
    switch (getCatalogVisibility(metadata)) {
        case GameVisibility.Alpha:
            return TitleMaturity.Alpha
        case GameVisibility.Beta:
            return TitleMaturity.Beta
        case GameVisibility.Public:
            return metadata.beta ? TitleMaturity.Beta : TitleMaturity.Released
    }
}

export function canDiscoverTitle(metadata: GameMetadata, roles: readonly Role[]): boolean {
    if (roles.includes(Role.Admin)) return true
    switch (getCatalogVisibility(metadata)) {
        case GameVisibility.Alpha:
            return roles.includes(Role.AlphaTester) || roles.includes(Role.Developer)
        case GameVisibility.Beta:
            return roles.includes(Role.BetaTester) || roles.includes(Role.Developer)
        case GameVisibility.Public:
            return true
    }
}
