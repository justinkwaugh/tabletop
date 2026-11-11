import { assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import type { SpaceId } from '../data/board.js'
import { discChoices, replaceLocationDisc } from '../model/locationDiscs.js'
import { CombatTarget } from '../model/flow.js'
import { queueFollowUp } from '../model/followUps.js'
import { combatStrength, type CombatStrength } from '../model/combatStrength.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import { moveConcealedSeal } from '../model/seals.js'
import {
    ComponentCount,
    DiscIdSchema,
    GuildIdSchema,
    MonsterIdSchema,
    PawnNumberSchema,
    SpaceIdSchema,
    VesselTypeSchema
} from '../model/stateSchemas.js'
import { cardOf } from './cardPlay.js'
import { leaveBoard } from './migrate.js'

/** R-4.8.2 Each line of the attack, for the history sentence. */
const AttackRecord = Type.Object({
    pawns: ComponentCount,
    monsters: ComponentCount,
    saltpeter: ComponentCount,
    weapons: ComponentCount,
    serf: ComponentCount,
    total: ComponentCount
})

/** R-4.8.2 Each line of the defence. */
const DefenceRecord = Type.Object({
    pawns: ComponentCount,
    monsters: ComponentCount,
    feudum: ComponentCount,
    subject: ComponentCount,
    defend: ComponentCount,
    total: ComponentCount
})

/** R-4.8.3 What a win took off the board. */
const ConqueredPiece = Type.Union([
    Type.Object({
        kind: Type.Literal('pawn'),
        n: PawnNumberSchema,
        character: GuildIdSchema,
        /** R-4.8-H4 Stays on the space, abandoned. */
        vessel: Type.Optional(VesselTypeSchema),
        /** R-4.8-H4 The pawn's wine sulfur went to the haversack. */
        wine: Type.Optional(Type.Literal(true))
    }),
    Type.Object({ kind: Type.Literal('monster'), monsterId: MonsterIdSchema }),
    Type.Object({
        kind: Type.Literal('feudum'),
        /** R-4.8-H2 The disc that now shows the outpost. */
        discId: DiscIdSchema,
        markersHome: Type.Array(Type.Object({ playerId: Type.String(), count: ComponentCount })),
        /** R-4.8.3 The attacking serf, now ruling the outpost. */
        newRulerId: Type.Optional(Type.String())
    })
])

/** R-4.8.2, R-4.8.3 Every fact of a resolved combat that no input carries. */
export type CombatRecord = Type.Static<typeof CombatRecord>
export const CombatRecord = Type.Object({
    defenderId: Type.String(),
    spaceId: SpaceIdSchema,
    target: CombatTarget,
    defendFlipped: Type.Boolean(),
    attack: AttackRecord,
    defence: DefenceRecord,
    attackerWins: Type.Boolean(),
    /** R-4.8.3 0 on a loss. */
    vp: ComponentCount,
    /** R-4.5.4 */
    rankChanges: Type.Array(RankChange),
    conquered: Type.Optional(ConqueredPiece)
})

/** R-3.14-H1 Whether Conquer asks: an unplayed card, and no Defend played this round. */
export function defenderAsked(state: HydratedFeudumGameState, defenderId: string): boolean {
    const { handCount, played } = state.getPlayerState(defenderId)
    return handCount > 0 && !played.some((card) => card.kind === 'defend')
}

/**
 * R-4.8-H5 From what the table can see alone: goods on hand, a tile for a saltpeter, or an unsealed
 * writ that could be a weapon. So the prompt says nothing about what the writs are.
 */
export function attackerMayAdd(state: HydratedFeudumGameState, attackerId: string): boolean {
    const { goods, regionTiles, writCount, sealedCharterCount } = state.getPlayerState(attackerId)
    return (
        goods.saltpeter > 0 ||
        (regionTiles.length > 0 && state.supply.haversack.saltpeter > 0) ||
        writCount > sealedCharterCount
    )
}

/** R-3.13.1 2 vp for a pawn or monster, 4 for a feudum: the card's printed pair. */
export function conquerVp(target: CombatTarget): number {
    const { vp } = cardOf('conquer')
    assert(vp !== null && vp !== 'variable', 'R-3.13.1 Conquer prints its vp')
    return target.kind === 'feudum' ? vp[1] : vp[0]
}

/** R-4.8.2 The tally as things stand, with what the attacker would add. */
export function strengthOf(
    state: HydratedFeudumGameState,
    combat: {
        readonly attackerId: string
        readonly defenderId: string
        readonly spaceId: SpaceId
        readonly target: CombatTarget
        readonly defendFlipped: boolean
    },
    saltpeter: number,
    weapons: number
): CombatStrength {
    const { target, ...sides } = combat
    return combatStrength(state, { ...sides, target: target.kind, saltpeter, weapons })
}

/** R-4.8.3 A monster goes back to the Knight Guild; its player's marker comes home (R-4.2.4). */
function monsterFalls(
    state: HydratedFeudumGameState,
    attackerId: string,
    monsterId: Extract<CombatTarget, { kind: 'monster' }>['monsterId']
): void {
    const { playerId } = state.monsters[monsterId]
    assertExists(playerId, 'R-3.13.1 A targeted monster is held by a player')
    state.getPlayerState(playerId).influenceSupply += 1
    state.monsters[monsterId] = {}
    state.guilds.knight.monsterIcons[monsterId] = null
    state.getPlayerState(attackerId).defeatedMonster = true
}

/**
 * R-4.8.3 The feudum gives way to an outpost: markers go home, except the attacking serf's, which
 * takes the rule. R-4.8-H2 The lowest outpost disc in supply replaces it; R-4.8-H3 seals under
 * markers go to the markers' owners. Goods and landscape stay.
 */
function feudumFalls(
    state: HydratedFeudumGameState,
    attackerId: string,
    spaceId: SpaceId
): Extract<NonNullable<CombatRecord['conquered']>, { kind: 'feudum' }> {
    const space = state.spaces[spaceId]
    const { ruler, serf, location } = space
    assertExists(ruler, 'R-3.13.1 A targeted feudum has a ruler')
    if (ruler.subjectImmune) {
        moveConcealedSeal(
            state,
            { kind: 'immunity', spaceId, role: 'subject' },
            { kind: 'held', playerId: ruler.playerId }
        )
    }
    if (serf?.immune) {
        moveConcealedSeal(
            state,
            { kind: 'immunity', spaceId, role: 'serf' },
            { kind: 'held', playerId: serf.playerId }
        )
    }

    const markersHome = [{ playerId: ruler.playerId, count: ruler.subject ? 2 : 1 }]
    const rebel = serf?.playerId === attackerId
    if (serf && !rebel) {
        markersHome.push({ playerId: serf.playerId, count: 1 })
    }
    for (const { playerId, count } of markersHome) {
        state.getPlayerState(playerId).influenceSupply += count
    }
    space.ruler = rebel ? { playerId: attackerId, subject: false } : undefined
    space.serf = undefined

    const [outpost] = discChoices(state, 'outpost')
    if (outpost) {
        replaceLocationDisc(state, spaceId, outpost.discId, 'outpost')
    } else {
        space.location = { kind: 'outpost', discId: location.discId, face: location.face }
    }
    return {
        kind: 'feudum',
        discId: space.location.discId,
        markersHome,
        ...(rebel ? { newRulerId: attackerId } : {})
    }
}

function pieceFalls(
    state: HydratedFeudumGameState,
    attackerId: string,
    spaceId: SpaceId,
    target: CombatTarget
): NonNullable<CombatRecord['conquered']> {
    switch (target.kind) {
        case 'pawn': {
            const { vessel, wine, character } = leaveBoard(state, target.playerId, target.n)
            return {
                kind: 'pawn',
                n: target.n,
                character,
                ...(vessel ? { vessel } : {}),
                ...(wine ? { wine } : {})
            }
        }
        case 'monster':
            monsterFalls(state, attackerId, target.monsterId)
            return { kind: 'monster', monsterId: target.monsterId }
        case 'feudum':
            return feudumFalls(state, attackerId, spaceId)
    }
}

/**
 * R-4.8.2, R-4.8.3, R-4.9-H1 Ends the combat in `flow.combat`. A win takes the piece, scores 2 or
 * 4 vp, recomputes status and queues the military follow-up; a loss changes nothing more.
 */
export function resolveCombat(
    state: HydratedFeudumGameState,
    saltpeter: number,
    weapons: number
): CombatRecord {
    const combat = state.flow.combat
    assertExists(combat, 'R-4.8 A combat is under way')
    const { attackerId, defenderId, spaceId, target, defendFlipped } = combat
    const { attack, defence, attackerWins } = strengthOf(state, combat, saltpeter, weapons)
    state.flow.combat = undefined
    const fought = {
        defenderId,
        spaceId,
        target,
        defendFlipped,
        attack: { ...attack },
        defence: { ...defence },
        attackerWins
    }
    if (!attackerWins) {
        return { ...fought, vp: 0, rankChanges: [] }
    }
    const conquered = pieceFalls(state, attackerId, spaceId, target)
    const vp = conquerVp(target)
    state.getPlayerState(attackerId).score += vp
    const rankChanges = state.recomputeRanks(attackerId)
    queueFollowUp(state, { kind: 'military', playerId: attackerId })
    return { ...fought, vp, rankChanges, conquered }
}
