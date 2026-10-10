import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedRoundManager,
    HydratedTurnManager,
    PrngState,
    RoundManager,
    Visibility,
    assert,
    assertExists,
    type RandomState
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { AUSTERLITZ } from '../components/austerlitz.js'
import type { ApproachId, BattleMap, LocaleId } from '../components/battleMap.js'
import {
    FAILED_GUARD_ATTACK_PENALTY,
    GUARD_COMMITMENT_PENALTY,
    HEAVY_CAVALRY_COMMITMENT_PENALTY,
    Side,
    isGuard,
    isHeavyCavalry,
    opposingSide,
    reducedFace,
    type Face
} from '../components/pieces.js'
import { Scenario, roundDefinition, type RoundDefinition } from '../components/timeTrack.js'
import { Attack, RoadMarch, type LossEntry } from './attack.js'
import {
    Commander,
    Position,
    Unit,
    faceOf,
    inReserve,
    isOnMap,
    samePosition,
    type ProjectedUnit
} from './pieces.js'
import { HydratedNapoleonsTriumphPlayerState, NapoleonsTriumphPlayerState } from './playerState.js'

export type TurnLimits = Type.Static<typeof TurnLimits>
export const TurnLimits = Type.Object({
    /** Rule 11: no further attack crosses an approach where one was feinted or repulsed this turn. */
    closedApproaches: Type.Array(Type.Integer()),
    /** Rule 11: a second attack across an approach artillery fired over may not be led by artillery. */
    bombardedApproaches: Type.Array(Type.Integer()),
    /** Rule 11: only the attackers enter a locale won in combat this turn. */
    stormedLocales: Type.Array(Type.Integer()),
    /** Rule 10: no other unit uses a reserve a corps of two or more units marched into. */
    marchedLocales: Type.Array(Type.Integer())
})

export enum VictoryKind {
    Decisive = 'Decisive',
    Marginal = 'Marginal'
}

export type Auction = Type.Static<typeof Auction>
export const Auction = Type.Object({
    highBid: Type.Optional(Type.Integer({ minimum: 0 })),
    highBidderId: Type.Optional(Type.String())
})

export type NapoleonsTriumphGameState = Type.Static<typeof NapoleonsTriumphGameState>
export const NapoleonsTriumphGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(NapoleonsTriumphPlayerState),
    machineState: Type.Enum(MachineState),
    rounds: RoundManager,
    scenario: Type.Enum(Scenario),
    santon: Type.Boolean(),
    units: Type.Array(Unit),
    commanders: Type.Array(Commander),
    frenchReinforcementsEntered: Type.Boolean(),
    artilleryFire: Type.Record(Type.String(), Type.Integer()),
    limits: TurnLimits,
    attack: Type.Optional(Attack),
    roadMarch: Type.Optional(RoadMarch),
    auction: Type.Optional(Auction),
    victory: Type.Optional(Type.Enum(VictoryKind))
})

export const NapoleonsTriumphGameStateValidator = Compile(NapoleonsTriumphGameState)
export const NapoleonsTriumphProjectedState =
    Visibility.createProjectionSchema(NapoleonsTriumphGameState)
export type NapoleonsTriumphProjectedState = Type.Static<typeof NapoleonsTriumphProjectedState>
export const NapoleonsTriumphProjectedStateValidator = Compile(NapoleonsTriumphProjectedState)

export function emptyTurnLimits(): TurnLimits {
    return { closedApproaches: [], bombardedApproaches: [], stormedLocales: [], marchedLocales: [] }
}

export class HydratedNapoleonsTriumphGameState
    extends HydratableGameState<
        typeof NapoleonsTriumphProjectedState,
        HydratedNapoleonsTriumphPlayerState
    >
    implements NapoleonsTriumphProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedNapoleonsTriumphPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare rounds: HydratedRoundManager
    declare scenario: Scenario
    declare santon: boolean
    declare units: ProjectedUnit[]
    declare commanders: Commander[]
    declare frenchReinforcementsEntered: boolean
    declare artilleryFire: Record<string, number>
    declare limits: TurnLimits
    declare attack?: NapoleonsTriumphProjectedState['attack']
    declare roadMarch?: RoadMarch
    declare auction?: Auction
    declare victory?: VictoryKind

    constructor(data: NapoleonsTriumphProjectedState) {
        super(data, NapoleonsTriumphProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedNapoleonsTriumphPlayerState(player))
        this.rounds = new HydratedRoundManager(data.rounds)
    }

    get map(): BattleMap {
        return AUSTERLITZ
    }

    get round(): number {
        const current = this.rounds.currentRound
        assertExists(current, 'No round is in progress')
        return current.number - 1
    }

    get currentRound(): RoundDefinition {
        return roundDefinition(this.scenario, this.round)
    }

    sideOf(playerId: string): Side {
        const side = this.getPlayerState(playerId).side
        assertExists(side, `Player ${playerId} has no side yet`)
        return side
    }

    playerOf(side: Side): HydratedNapoleonsTriumphPlayerState {
        const player = this.players.find((candidate) => candidate.side === side)
        assertExists(player, `No player commands the ${side} army`)
        return player
    }

    opponentOf(playerId: string): HydratedNapoleonsTriumphPlayerState {
        return this.playerOf(opposingSide(this.sideOf(playerId)))
    }

    get turnPlayerId(): string {
        const turn = this.turnManager.currentTurn()
        assertExists(turn, 'No player turn is in progress')
        return turn.playerId
    }

    unit(id: string): ProjectedUnit {
        const unit = this.units.find((candidate) => candidate.id === id)
        assertExists(unit, `Unknown unit ${id}`)
        return unit
    }

    findUnit(id: string): ProjectedUnit | undefined {
        return this.units.find((candidate) => candidate.id === id)
    }

    commander(id: string): Commander {
        const commander = this.commanders.find((candidate) => candidate.id === id)
        assertExists(commander, `Unknown commander ${id}`)
        return commander
    }

    unitsOf(playerId: string): ProjectedUnit[] {
        return this.units.filter((unit) => unit.playerId === playerId)
    }

    commandersOf(playerId: string): Commander[] {
        return this.commanders.filter((commander) => commander.playerId === playerId)
    }

    corpsUnits(commanderId: string): ProjectedUnit[] {
        return this.units.filter((unit) => unit.commanderId === commanderId)
    }

    unitsIn(locale: LocaleId, playerId?: string): ProjectedUnit[] {
        return this.units.filter(
            (unit) =>
                unit.position?.locale === locale &&
                (playerId === undefined || unit.playerId === playerId)
        )
    }

    commandersIn(locale: LocaleId, playerId?: string): Commander[] {
        return this.commanders.filter(
            (commander) =>
                commander.position?.locale === locale &&
                (playerId === undefined || commander.playerId === playerId)
        )
    }

    unitsAt(position: Position, playerId?: string): ProjectedUnit[] {
        return this.units.filter(
            (unit) =>
                samePosition(unit.position, position) &&
                (playerId === undefined || unit.playerId === playerId)
        )
    }

    commandersAt(position: Position, playerId?: string): Commander[] {
        return this.commanders.filter(
            (commander) =>
                samePosition(commander.position, position) &&
                (playerId === undefined || commander.playerId === playerId)
        )
    }

    occupantOf(locale: LocaleId): string | undefined {
        return (
            this.units.find((unit) => unit.position?.locale === locale)?.playerId ??
            this.commanders.find((commander) => commander.position?.locale === locale)?.playerId
        )
    }

    isEnemyOccupied(locale: LocaleId, playerId: string): boolean {
        const occupant = this.occupantOf(locale)
        return occupant !== undefined && occupant !== playerId
    }

    freeCapacity(locale: LocaleId, playerId: string, leaving: readonly string[] = []): number {
        const present = this.unitsIn(locale, playerId).filter((unit) => !leaving.includes(unit.id))
        return this.map.locale(locale).capacity - present.length
    }

    /** Enemy corps of two or more units in a locale (rule 10, road movement). */
    hasLargeCorps(locale: LocaleId, playerId: string): boolean {
        return this.commandersIn(locale, playerId).some(
            (commander) => this.corpsUnits(commander.id).length >= 2
        )
    }

    reveal(unit: ProjectedUnit) {
        unit.shown = { ...faceOf(unit) }
    }

    revealAll(units: readonly ProjectedUnit[]) {
        for (const unit of units) {
            this.reveal(unit)
        }
    }

    private setFace(unit: ProjectedUnit, face: Face) {
        unit.face = face
        if (unit.shown) {
            unit.shown = { ...face }
        }
    }

    /**
     * The first use of heavy cavalry or of the Guard costs its army morale (rule 15). Returns the
     * morale lost.
     */
    commit(unit: ProjectedUnit): number {
        const player = this.getPlayerState(unit.playerId)
        const face = faceOf(unit)
        let penalty = 0
        if (isHeavyCavalry(face) && !player.heavyCavalryCommitted) {
            player.heavyCavalryCommitted = true
            penalty += HEAVY_CAVALRY_COMMITMENT_PENALTY
        }
        if (isGuard(face) && !player.guardCommitted) {
            player.guardCommitted = true
            penalty += GUARD_COMMITMENT_PENALTY
        }
        const lost = Math.min(penalty, player.morale - 1)
        player.morale -= lost
        player.moraleLost += lost
        return lost
    }

    takeLoss(unit: ProjectedUnit, steps: number): LossEntry {
        assert(steps > 0, 'A loss must remove at least one step')
        this.commit(unit)
        const before = faceOf(unit)
        const taken = Math.min(steps, before.strength)
        const after = reducedFace(before, taken)
        if (after) {
            this.setFace(unit, after)
        } else {
            this.eliminate(unit)
        }
        return { unitId: unit.id, steps: taken, eliminated: !after, face: before }
    }

    eliminate(unit: ProjectedUnit) {
        this.units = this.units.filter((candidate) => candidate.id !== unit.id)
        const commanderId = unit.commanderId
        if (commanderId !== undefined && this.corpsUnits(commanderId).length === 0) {
            const commander = this.commander(commanderId)
            commander.eliminated = true
            commander.position = undefined
        }
    }

    /**
     * Lowers an army's morale. A loss from an artillery-led attack cannot be the one that breaks
     * it (rule 13). Returns whether the army is now demoralized.
     */
    loseMorale(playerId: string, points: number, fromArtillery = false): boolean {
        const player = this.getPlayerState(playerId)
        if (points <= 0) {
            return false
        }
        if (player.morale - points >= 1 || fromArtillery) {
            const lost = Math.min(points, player.morale - 1)
            player.morale -= lost
            player.moraleLost += lost
            return false
        }
        player.moraleLost += player.morale
        player.morale = 0
        return true
    }

    failGuardAttack(playerId: string): boolean {
        this.getPlayerState(playerId).guardAttackForfeited = true
        return this.loseMorale(playerId, FAILED_GUARD_ATTACK_PENALTY)
    }

    isDemoralized(playerId: string): boolean {
        return this.getPlayerState(playerId).morale <= 0
    }

    detach(unit: ProjectedUnit) {
        unit.commanderId = undefined
    }

    place(pieces: readonly { position?: Position }[], position: Position) {
        for (const piece of pieces) {
            piece.position = { ...position }
        }
    }

    piecesOnMap(playerId: string): (ProjectedUnit | Commander)[] {
        return [...this.unitsOf(playerId), ...this.commandersOf(playerId)].filter(isOnMap)
    }

    blockers(approach: ApproachId, playerId?: string): ProjectedUnit[] {
        const locale = this.map.approach(approach).locale
        return this.unitsAt({ locale, approach }, playerId)
    }

    reserveUnits(locale: LocaleId, playerId?: string): ProjectedUnit[] {
        return this.unitsIn(locale, playerId).filter(
            (unit) => unit.position !== undefined && inReserve(unit.position)
        )
    }
}
