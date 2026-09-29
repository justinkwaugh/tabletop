import { bannerHolder } from '../util/oathkeeper.js'
import { giveFavor, usableFavor } from '../util/favor.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { reasonPersistentForbidsExile } from '../util/persistent.js'
import { ActionType } from '../definition/actions.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { canUseGrandScepter, holdsGrandScepter } from '../util/imperial.js'
import { becomeExile } from '../util/citizenship.js'

// R-6.7
export const EXILE_CITIZEN_BASE_COST = 5

export type ExileCitizenMetadata = Type.Static<typeof ExileCitizenMetadata>
export const ExileCitizenMetadata = Type.Object({
    favorGiven: Type.Number(),
    costModifier: Type.Number(),
    recoloredCount: Type.Number(),
    // R-9.3 — purple left for want of their own colour.
    unreplacedCount: Type.Number()
})

export type ExileCitizen = Type.Static<typeof ExileCitizen>
export const ExileCitizen = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExileCitizen),
            playerId: Type.String(),
            citizenPlayerId: Type.String(),
            metadata: Type.Optional(ExileCitizenMetadata)
        })
    ])
)

export const ExileCitizenValidator = Compile(ExileCitizen)

export function isExileCitizen(action?: GameAction): action is ExileCitizen {
    return action?.type === ActionType.ExileCitizen
}

export class HydratedExileCitizen
    extends HydratableAction<typeof ExileCitizen>
    implements ExileCitizen
{
    declare type: ActionType.ExileCitizen
    declare playerId: string
    declare citizenPlayerId: string
    declare metadata?: ExileCitizenMetadata

    constructor(data: ExileCitizen) {
        super(data, ExileCitizenValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedExileCitizen.reasonCannotExile(
            state,
            this.playerId,
            this.citizenPlayerId
        )
        if (reason) {
            throw Error(`Cannot exile Citizen: ${reason}`)
        }

        const cost = HydratedExileCitizen.exileCost(state, this.playerId, this.citizenPlayerId)

        // R-10.11: the favor is given, not burned.
        giveFavor(state, this.playerId, this.citizenPlayerId, cost)

        // R-6.7 recolours the board only; the purple on the map stays the Empire's.
        const conversion = becomeExile(state, this.citizenPlayerId)

        this.metadata = {
            favorGiven: cost,
            costModifier: cost - EXILE_CITIZEN_BASE_COST,
            recoloredCount: conversion.recoloredCount,
            unreplacedCount: conversion.unreplacedCount
        }
    }

    // R-6.7
    static exileCost(
        state: HydratedOathGameState,
        playerId: string,
        citizenPlayerId: string
    ): number {
        const standing = (id: string) =>
            (state.oathkeeperPlayerId === id ? 1 : 0) +
            (bannerHolder(state, Banner.PeoplesFavor) === id ? 1 : 0)

        return EXILE_CITIZEN_BASE_COST + standing(citizenPlayerId) - standing(playerId)
    }

    static reasonCannotExile(
        state: HydratedOathGameState,
        playerId: string,
        citizenPlayerId: string
    ): string | undefined {
        // R-6.7: the Grand Scepter, not the Chancellor's seat.
        if (!holdsGrandScepter(state, playerId)) {
            return 'exiling a Citizen requires the Grand Scepter'
        }
        if (!canUseGrandScepter(state, playerId)) {
            return 'the Grand Scepter cannot be used on the turn it was taken'
        }

        const citizen = state.findPlayerState(citizenPlayerId)
        if (!citizen) return `no such player ${citizenPlayerId}`
        if (citizenPlayerId === playerId) {
            return 'exiling yourself is R-6.8, not R-6.7'
        }
        // R-7.1.4 Council Seat: "you cannot be exiled, even by yourself".
        const seated = reasonPersistentForbidsExile(state, citizenPlayerId)
        if (seated) return seated
        if (citizen.status !== PlayerStatus.Citizen) {
            return `${citizenPlayerId} is a ${citizen.status}, not a Citizen`
        }

        const cost = HydratedExileCitizen.exileCost(state, playerId, citizenPlayerId)
        const usable = usableFavor(state, playerId)
        if (usable < cost) {
            return `costs ${cost} favor, player has ${usable}`
        }
        return undefined
    }

    static legalTargets(state: HydratedOathGameState, playerId: string): string[] {
        return state.players
            .map((p) => p.playerId)
            .filter(
                (id) => HydratedExileCitizen.reasonCannotExile(state, playerId, id) === undefined
            )
    }

    static canDoExileCitizen(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedExileCitizen.legalTargets(state, playerId).length > 0
    }
}
