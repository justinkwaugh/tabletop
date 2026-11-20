import type { GuildId } from '../data/components.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { AlchemistFunctions } from './alchemist.js'
import { FarmerFunctions } from './farmer.js'
import {
    scoreFunction,
    scoringPreview,
    type FunctionActor,
    type GuildFunctionName,
    type GuildFunctionOutcome,
    type GuildFunctionParams,
    type GuildFunctionRow,
    type PreviewedFunction,
    type ScoringPreview
} from './guildFunction.js'
import { KnightFunctions } from './knight.js'
import { MerchantFunctions } from './merchant.js'
import { MonkFunctions } from './monk.js'
import { NobleFunctions } from './noble.js'

/** R-4.6 One row per guild. A new guild adds one import and one row. */
const GuildFunctionRows: Readonly<
    Record<GuildId, Readonly<Record<GuildFunctionName, GuildFunctionRow>>>
> = {
    farmer: FarmerFunctions,
    merchant: MerchantFunctions,
    alchemist: AlchemistFunctions,
    knight: KnightFunctions,
    noble: NobleFunctions,
    monk: MonkFunctions
}

export function guildFunctionRow(guildId: GuildId, fn: GuildFunctionName): GuildFunctionRow {
    return GuildFunctionRows[guildId][fn]
}

export interface PerformedGuildFunction {
    readonly outcome: GuildFunctionOutcome
    readonly revealsInfo: boolean
}

/** R-4.6, R-4.7 The caller has checked the reason and sets `metadata` and `revealsInfo`. */
export function performGuildFunction(
    state: HydratedFeudumGameState,
    actor: FunctionActor,
    guildId: GuildId,
    fn: GuildFunctionName,
    row: GuildFunctionRow,
    params: GuildFunctionParams
): PerformedGuildFunction {
    const { revealed, ...performed } = row.perform(state, actor, params)
    const scored = scoreFunction(state, actor, guildId, fn, performed.completions ?? 0)
    return {
        outcome: { ...performed, ...scored, rankChanges: state.recomputeRanks(actor.playerId) },
        revealsInfo: revealed === true || (scored.drawnCount ?? 0) > 0
    }
}

export type GuildFunctionPreview = PreviewedFunction &
    ScoringPreview & {
        /** R-X.2 The send can't be undone. */
        readonly revealsInfo: boolean
    }

/** R-4.6, R-4.7 What the send would do; undefined for an input that cannot happen. */
export function guildFunctionPreview(
    state: HydratedFeudumGameState,
    actor: FunctionActor,
    guildId: GuildId,
    fn: GuildFunctionName,
    row: GuildFunctionRow,
    params: GuildFunctionParams
): GuildFunctionPreview | undefined {
    const previewed = row.preview(state, actor, params)
    if (!previewed) {
        return undefined
    }
    const scoring = scoringPreview(state, actor, guildId, fn, previewed.completions ?? 0)
    return {
        ...previewed,
        ...scoring,
        revealsInfo: previewed.revealed === true || scoring.drawnCount > 0
    }
}
