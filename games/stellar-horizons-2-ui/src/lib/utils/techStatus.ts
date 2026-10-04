import {
    TECHS,
    canAffordTech,
    isTechAvailable,
    techCost,
    type Faction,
    type HydratedStellarHorizonsGameState,
    type TechDefinition
} from '@tabletop/stellar-horizons-2'

export enum TechStatus {
    Owned = 'Owned',
    Choosable = 'Choosable',
    Unlocked = 'Unlocked',
    Locked = 'Locked'
}

export interface TechView {
    tech: TechDefinition
    status: TechStatus
    cost: number
    ownerFactions: Faction[]
}

export function techViews(
    state: HydratedStellarHorizonsGameState,
    playerId: string | undefined,
    developing: boolean
): TechView[] {
    const player = playerId ? state.findPlayerState(playerId) : undefined
    return TECHS.map((tech) => {
        const ownerFactions = state.players.flatMap((owner) =>
            owner.ownsTech(tech.id) && owner.faction ? [owner.faction] : []
        )
        if (!player || !playerId) {
            return { tech, status: TechStatus.Locked, cost: tech.cost, ownerFactions }
        }
        const cost = techCost(state, playerId, tech.id)
        const status = player.ownsTech(tech.id)
            ? TechStatus.Owned
            : developing &&
                isTechAvailable(state, playerId, tech.id) &&
                canAffordTech(state, playerId, tech.id)
              ? TechStatus.Choosable
              : tech.prerequisites.every((prerequisite) => player.ownsTech(prerequisite))
                ? TechStatus.Unlocked
                : TechStatus.Locked
        return { tech, status, cost, ownerFactions }
    })
}
