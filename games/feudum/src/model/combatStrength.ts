import type { SpaceId } from '../data/board.js'
import { Monsters, type MonsterRow } from '../data/components.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { PawnState } from './playerState.js'

/** R-4.8.2 What each thing on the space, or put in, is worth. */
const Strength = {
    attackingPawn: 1,
    saltpeter: 1,
    attackerSerf: 1,
    defendingPawn: 2,
    feudum: 2,
    defenderSubject: 1,
    flippedDefend: 1
} as const

export interface CombatInput {
    readonly attackerId: string
    readonly defenderId: string
    readonly spaceId: SpaceId
    /** R-3.13.1 */
    readonly target: 'pawn' | 'monster' | 'feudum'
    readonly saltpeter: number
    /** R-4.8.2 The weapons' total: each is +1 or +2. */
    readonly weapons: number
    readonly defendFlipped: boolean
}

/** R-4.8.2 Each line of the tally, for the combat display. */
export interface AttackStrength {
    readonly pawns: number
    readonly monsters: number
    readonly saltpeter: number
    readonly weapons: number
    readonly serf: number
    readonly total: number
}

/** R-4.8.2 */
export interface DefenceStrength {
    readonly pawns: number
    readonly monsters: number
    readonly feudum: number
    readonly subject: number
    readonly defend: number
    readonly total: number
}

export interface CombatStrength {
    readonly attack: AttackStrength
    readonly defence: DefenceStrength
    readonly attackerWins: boolean
}

function pawnsOn(state: HydratedFeudumGameState, playerId: string, spaceId: SpaceId): PawnState[] {
    return state.getPlayerState(playerId).pawns.filter((pawn) => pawn.spaceId === spaceId)
}

function monstersOn(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId
): MonsterRow[] {
    return Monsters.filter(({ monster }) => {
        const { playerId: controller, spaceId: standsOn } = state.monsters[monster]
        return controller === playerId && standsOn === spaceId
    })
}

/** R-4.10.2 A drunk pawn's own attack and defence are 0. */
function soberPawns(pawns: readonly PawnState[]): number {
    return pawns.filter((pawn) => pawn.wine !== 'drunk').length
}

/** R-4.8.2, R-4.8-H1 Every piece the two players have on the space joins; attack must exceed defence. */
export function combatStrength(state: HydratedFeudumGameState, input: CombatInput): CombatStrength {
    const { attackerId, defenderId, spaceId, target } = input
    const space = state.spaces[spaceId]
    const feudumTarget = target === 'feudum'

    const attack = {
        pawns: soberPawns(pawnsOn(state, attackerId, spaceId)) * Strength.attackingPawn,
        monsters: monstersOn(state, attackerId, spaceId).reduce((sum, row) => sum + row.attack, 0),
        saltpeter: input.saltpeter * Strength.saltpeter,
        weapons: input.weapons,
        serf: feudumTarget && space.serf?.playerId === attackerId ? Strength.attackerSerf : 0
    }
    const defence = {
        pawns: soberPawns(pawnsOn(state, defenderId, spaceId)) * Strength.defendingPawn,
        monsters: monstersOn(state, defenderId, spaceId).reduce((sum, row) => sum + row.defence, 0),
        feudum: feudumTarget ? Strength.feudum : 0,
        subject:
            feudumTarget && space.ruler?.playerId === defenderId && space.ruler.subject
                ? Strength.defenderSubject
                : 0,
        defend: input.defendFlipped ? Strength.flippedDefend : 0
    }
    const attackTotal =
        attack.pawns + attack.monsters + attack.saltpeter + attack.weapons + attack.serf
    const defenceTotal =
        defence.pawns + defence.monsters + defence.feudum + defence.subject + defence.defend
    return {
        attack: { ...attack, total: attackTotal },
        defence: { ...defence, total: defenceTotal },
        attackerWins: attackTotal > defenceTotal
    }
}

/** R-4.8.2 One saltpeter, or any number if an attacking pawn is a knight, drunk or not. */
export function saltpeterAllowed(
    state: HydratedFeudumGameState,
    attackerId: string,
    spaceId: SpaceId,
    amount: number
): boolean {
    return (
        amount <= 1 ||
        pawnsOn(state, attackerId, spaceId).some((pawn) => pawn.character === 'knight')
    )
}
