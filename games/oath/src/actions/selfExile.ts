import { giveFavor, usableFavor } from '../util/favor.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { reasonPersistentForbidsExile } from '../util/persistent.js'
import { ActionType } from '../definition/actions.js'
import { CardKind, PlayerStatus } from '../model/oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import { grandScepterHolderId, holdsGrandScepter } from '../util/imperial.js'
import { becomeExile, citizenshipEndsActPhase } from '../util/citizenship.js'
import { totalWarbands } from '../util/warbands.js'

export type SelfExileMetadata = Type.Static<typeof SelfExileMetadata>
export const SelfExileMetadata = Type.Object({
    favorGiven: Type.Number(),
    secretsOnBoard: Type.Number(),
    secretsOnCards: Type.Number(),
    warbandsOnBoard: Type.Number(),
    replacedCount: Type.Number(),
    // R-9.3 — Imperial warbands left for want of their own.
    unreplacedCount: Type.Number(),
    // R-6.8 — applied by the Act Phase state handler.
    endsActPhase: Type.Boolean()
})

export type SelfExile = Type.Static<typeof SelfExile>
export const SelfExile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SelfExile),
            playerId: Type.String(),
            metadata: Type.Optional(SelfExileMetadata)
        })
    ])
)

export const SelfExileValidator = Compile(SelfExile)

export function isSelfExile(action?: GameAction): action is SelfExile {
    return action?.type === ActionType.SelfExile
}

export class HydratedSelfExile extends HydratableAction<typeof SelfExile> implements SelfExile {
    declare type: ActionType.SelfExile
    declare playerId: string
    declare metadata?: SelfExileMetadata

    constructor(data: SelfExile) {
        super(data, SelfExileValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedSelfExile.reasonCannotSelfExile(state, this.playerId)
        if (reason) {
            throw Error(`Cannot self-exile: ${reason}`)
        }

        const price = HydratedSelfExile.selfExileCost(state, this.playerId)
        const holderId = grandScepterHolderId(state)
        assertExists(holderId, 'nobody holds the Grand Scepter')

        // R-10.11: the favor is given, not burned.
        giveFavor(state, this.playerId, holderId, price.total)

        const endsActPhase = citizenshipEndsActPhase(state, this.playerId)

        // R-6.8 replaces the board's warbands only; those on the map stay the Empire's.
        const conversion = becomeExile(state, this.playerId)

        this.metadata = {
            favorGiven: price.total,
            secretsOnBoard: price.secretsOnBoard,
            secretsOnCards: price.secretsOnCards,
            warbandsOnBoard: price.warbandsOnBoard,
            replacedCount: conversion.replacedCount,
            unreplacedCount: conversion.unreplacedCount,
            endsActPhase
        }
    }

    static selfExileCost(
        state: HydratedOathGameState,
        playerId: string
    ): {
        total: number
        secretsOnBoard: number
        secretsOnCards: number
        warbandsOnBoard: number
    } {
        const player = state.getPlayerState(playerId)

        // R-7.1.2.a: facedown secrets are still on the board, so both counts contribute.
        const secretsOnBoard = player.secrets + player.secretsFacedown

        // R-6.8 is unqualified: every denizen and relic card on the table counts, ruled or not.
        let secretsOnCards = 0
        for (const [cardId, tokens] of Object.entries(state.cardTokens)) {
            const kind = kindOf(cardId)
            if (kind === CardKind.Denizen || kind === CardKind.Relic) {
                secretsOnCards += tokens.secrets
            }
        }

        const warbandsOnBoard = totalWarbands(player.warbandsOnBoard)

        return {
            total: secretsOnBoard + secretsOnCards + warbandsOnBoard,
            secretsOnBoard,
            secretsOnCards,
            warbandsOnBoard
        }
    }

    static reasonCannotSelfExile(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        if (player.status !== PlayerStatus.Citizen) {
            return `only a Citizen can self-exile; ${playerId} is a ${player.status}`
        }
        // R-7.1.4 Council Seat: "you cannot be exiled, even by yourself".
        const seated = reasonPersistentForbidsExile(state, playerId)
        if (seated) return seated
        // R-6.8: "You cannot self-exile if you hold the Grand Scepter."
        if (holdsGrandScepter(state, playerId)) {
            return 'you cannot self-exile while you hold the Grand Scepter'
        }

        const holderId = grandScepterHolderId(state)
        if (!holderId) {
            return 'nobody holds the Grand Scepter to give the favor to'
        }

        const cost = HydratedSelfExile.selfExileCost(state, playerId).total
        const usable = usableFavor(state, playerId)
        if (usable < cost) {
            return `costs ${cost} favor, player has ${usable}`
        }
        return undefined
    }

    static canDoSelfExile(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedSelfExile.reasonCannotSelfExile(state, playerId) === undefined
    }
}
