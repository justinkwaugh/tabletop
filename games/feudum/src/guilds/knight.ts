import { assertExists } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import { MonsterIds, type MonsterId } from '../data/components.js'
import {
    KnightMonsterIcons,
    KnightPullInventions,
    KnightPushMarkers,
    KnightTradePrice,
    TameMarkersOnIcon
} from '../data/guilds.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import type { KnightRow } from '../model/guildsState.js'
import { seatKnightRow } from '../model/knightRows.js'
import { presenceSpaceIds } from '../model/locationControl.js'
import { monsterReaches } from '../model/media.js'
import { canPayGuild, guildSplit, payGuild } from '../model/payments.js'
import type { GuildFunctionName, GuildFunctionParams, GuildFunctionRow } from './guildFunction.js'
import { makeInventions, mostInventions, reasonInventionsRefused } from './inventions.js'
import { rowsToScrollsRow } from './rowsToScrolls.js'

/** R-1.4-H1 A seat's row is the one it owns. */
function seatRow(state: HydratedFeudumGameState, playerId: string): KnightRow | undefined {
    return seatKnightRow(state, playerId)?.row
}

function markersInRow(state: HydratedFeudumGameState, playerId: string): number {
    return seatRow(state, playerId)?.markers ?? 0
}

/** R-4.6.3 What taming this monster returns. */
function tameCost(monster: MonsterId): number {
    const icon = KnightMonsterIcons.find((row) => row.monster === monster)
    assertExists(icon, `R-4.2.4 ${monster} has an icon`)
    return icon.markers
}

function monsterName(monster: MonsterId): string {
    return monster.replace('-', ' ')
}

/** R-4.6.3 A port counts for the sea serpent (FAQ). */
function deploySpaces(
    state: HydratedFeudumGameState,
    playerId: string,
    monster: MonsterId
): SpaceId[] {
    return presenceSpaceIds(state, playerId).filter((spaceId) => monsterReaches(monster, spaceId))
}

export interface MonsterOffer {
    readonly monster: MonsterId
    /** R-4.6.3 Where it may be deployed at once. */
    readonly spaces: readonly SpaceId[]
}

export interface KnightTradeOffer {
    readonly price: number
    readonly markers: number
    /** R-4.6.3, R-4.6-H10 */
    readonly monsters: readonly MonsterOffer[]
}

/** R-4.6.3, R-4.2.4 The seat's row at its price, and what it could tame. */
export function knightTradeOffer(
    state: HydratedFeudumGameState,
    playerId: string
): KnightTradeOffer {
    const markers = markersInRow(state, playerId)
    const monsters = MonsterIds.filter(
        (monster) => markers >= tameCost(monster) && state.monsters[monster].playerId === undefined
    ).flatMap((monster) => {
        const spaces = deploySpaces(state, playerId, monster)
        return spaces.length > 0 ? [{ monster, spaces }] : []
    })
    return { price: KnightTradePrice, markers, monsters }
}

/** R-4.6.3 Tame the Beast as far as it is staged, read on a staged input too. */
function reasonTameCannotHappen(
    state: HydratedFeudumGameState,
    playerId: string,
    { monster, deploySpaceId }: GuildFunctionParams
): string | undefined {
    if (!monster) {
        return deploySpaceId ? 'Pick a monster to tame.' : undefined
    }
    const name = monsterName(monster)
    if (markersInRow(state, playerId) < tameCost(monster)) {
        return `Taming the ${name} takes ${tameCost(monster)} markers from your row.`
    }
    if (state.monsters[monster].playerId !== undefined) {
        return `The ${name} is already tamed.`
    }
    if (deploySpaces(state, playerId, monster).length === 0) {
        return `The ${name} has nowhere to deploy.`
    }
    if (deploySpaceId && !presenceSpaceIds(state, playerId).includes(deploySpaceId)) {
        return `Deploy the ${name} where you have a pawn or marker.`
    }
    return deploySpaceId && !monsterReaches(monster, deploySpaceId)
        ? `The ${name} can't reach that space.`
        : undefined
}

function tradeDetails(
    state: HydratedFeudumGameState,
    playerId: string,
    { monster }: GuildFunctionParams
) {
    const taken = markersInRow(state, playerId)
    return {
        kind: 'knight-trade' as const,
        taken,
        kept: taken - (monster ? tameCost(monster) : 0),
        price: KnightTradePrice
    }
}

const KnightTrade: GuildFunctionRow = {
    /** R-4.6.3, R-4.6.2 */
    reasonClosed(state, { playerId }) {
        if (markersInRow(state, playerId) === 0) {
            return 'Your Knight row holds no markers.'
        }
        return canPayGuild(state, playerId, KnightTradePrice)
            ? undefined
            : `Taking your row costs ${KnightTradePrice} shillings.`
    },

    /** R-4.6.3 Tame the Beast only during this trade, and it deploys at once. */
    reasonRefused(state, { playerId }, params) {
        const cannot = reasonTameCannotHappen(state, playerId, params)
        if (cannot) {
            return cannot
        }
        return params.monster && !params.deploySpaceId
            ? `Pick a space to deploy the ${monsterName(params.monster)}.`
            : undefined
    },

    /** R-4.6.3, R-4.6.2, R-4.2.4, R-1.4.2 A tame leaves one marker on the monster's icon. */
    perform(state, { playerId }, params) {
        const details = tradeDetails(state, playerId, params)
        const row = seatRow(state, playerId)
        const player = state.getPlayerState(playerId)
        if (row) {
            row.markers = 0
        }
        player.influenceSupply += details.kept
        const { monster, deploySpaceId } = params
        if (row && monster && deploySpaceId) {
            const toSupply = tameCost(monster) - TameMarkersOnIcon
            state.supply.influence[playerId] += toSupply
            state.monsters[monster] = { playerId, spaceId: deploySpaceId }
        }
        return {
            details,
            payment: payGuild(state, playerId, 'knight', KnightTradePrice)
        }
    },

    /** R-4.6.3 What the row and a staged tame would do, and where the shillings would go. */
    preview(state, { playerId }, params) {
        if (reasonTameCannotHappen(state, playerId, params)) {
            return undefined
        }
        return {
            details: tradeDetails(state, playerId, params),
            payment: guildSplit(state, 'knight', KnightTradePrice)
        }
    }
}

/** R-4.6.4 Moves the goods. Inventing is the threshold, so a legal pull always reaches it. */
function performPull(state: HydratedFeudumGameState, { inventions = [] }: GuildFunctionParams) {
    const { goodsUsed, barrels } = makeInventions(state, inventions)
    return {
        details: { kind: 'knight-pull' as const, goodsUsed, barrels },
        completions: inventions.length
    }
}

const KnightPull: GuildFunctionRow = {
    /** R-4.6.1 At least one must be possible. */
    reasonClosed(state) {
        return mostInventions(state, KnightPullInventions) > 0
            ? undefined
            : 'Nothing can be invented from the carts and piles.'
    },

    /** R-4.6.4, R-4.6-H4 One invention, so a barrel costs its first price. */
    reasonRefused(state, _actor, { inventions = [] }) {
        if (inventions.length === 0) {
            return 'Pick one invention.'
        }
        return reasonInventionsRefused(state, inventions, KnightPullInventions)
    },

    perform(state, _actor, params) {
        return performPull(state, params)
    },

    /** R-4.6.4 The real rule on a copy; a staged input with no pick is read too. */
    preview(state, _actor, params) {
        if (reasonInventionsRefused(state, params.inventions ?? [], KnightPullInventions)) {
            return undefined
        }
        return performPull(new HydratedFeudumGameState(state.dehydrate()), params)
    },

    /** R-4.6.4 */
    bestCompletions(state) {
        return mostInventions(state, KnightPullInventions)
    }
}

export const KnightFunctions: Readonly<Record<GuildFunctionName, GuildFunctionRow>> = {
    trade: KnightTrade,
    pull: KnightPull,
    /** R-4.6.5 Rows or columns completed, whichever the actor counts; absent, the higher. */
    push: rowsToScrollsRow({
        cap: KnightPushMarkers,
        moveAll: false,
        outcome({ markers, rows, columns }, { count }) {
            const chosen = count ?? (columns > rows ? 'columns' : 'rows')
            return {
                details: { kind: 'knight-push', markers, rows, columns, count: chosen },
                completions: chosen === 'rows' ? rows : columns
            }
        },
        reached: (lines) => lines
    })
}
