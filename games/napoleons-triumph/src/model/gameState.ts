import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedRoundManager,
    HydratedSimpleAuction,
    HydratedTurnManager,
    PrngState,
    RoundManager,
    SimpleAuction,
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
    sameFace,
    type Face
} from '../components/pieces.js'
import { Scenario, roundDefinition, type RoundDefinition } from '../components/timeTrack.js'
import {
    Attack,
    MoralePenaltyKind,
    RoadMarch,
    type LossEntry,
    type MoralePenalty
} from './attack.js'
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
import { withArmyDisplays } from './armyDisplay.js'

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
    /** Games begun before the bar was kept per army recorded artillery fire here, for both armies. */
    artilleryFire: Type.Optional(Type.Record(Type.String(), Type.Integer())),
    limits: TurnLimits,
    attack: Type.Optional(Attack),
    roadMarch: Type.Optional(RoadMarch),
    auction: Type.Optional(SimpleAuction),
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
    declare artilleryFire?: Record<string, number>
    declare limits: TurnLimits
    declare attack?: NapoleonsTriumphProjectedState['attack']
    declare roadMarch?: RoadMarch
    declare auction?: HydratedSimpleAuction
    declare victory?: VictoryKind

    constructor(input: NapoleonsTriumphProjectedState) {
        const data = withArmyDisplays(input)
        super(data, NapoleonsTriumphProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedNapoleonsTriumphPlayerState(player))
        this.rounds = new HydratedRoundManager(data.rounds)
        this.auction = data.auction ? new HydratedSimpleAuction(data.auction) : undefined
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

    /** Rule 11: the cavalry whose move by road is still open. */
    riders(): ProjectedUnit[] {
        return (this.roadMarch?.unitIds ?? []).map((id) => this.unit(id))
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

    unitsHiddenFrom(playerId: string): ProjectedUnit[] {
        return this.units.filter((unit) => unit.playerId !== playerId && unit.shown === undefined)
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

    private wearDown(player: HydratedNapoleonsTriumphPlayerState, points: number): number {
        const lost = player.wearDownLoss(points)
        player.morale -= lost
        player.moraleLost += lost
        return lost
    }

    /** Rule 15: the first use of heavy cavalry or of the Guard costs its army morale. */
    commit(unit: ProjectedUnit): MoralePenalty[] {
        const player = this.getPlayerState(unit.playerId)
        const { playerId } = player
        const face = faceOf(unit)
        const penalties: MoralePenalty[] = []
        if (isHeavyCavalry(face) && !player.heavyCavalryCommitted) {
            player.heavyCavalryCommitted = true
            penalties.push({
                playerId,
                kind: MoralePenaltyKind.HeavyCavalryCommitted,
                moraleLost: this.wearDown(player, HEAVY_CAVALRY_COMMITMENT_PENALTY)
            })
        }
        if (isGuard(face) && !player.guardCommitted) {
            player.guardCommitted = true
            penalties.push({
                playerId,
                kind: MoralePenaltyKind.GuardCommitted,
                moraleLost: this.wearDown(player, GUARD_COMMITMENT_PENALTY)
            })
        }
        return penalties
    }

    /** Rule 15: the caller commits the unit before it takes the loss. */
    takeLoss(unit: ProjectedUnit, steps: number): LossEntry {
        assert(steps > 0, 'A loss must remove at least one step')
        const before = faceOf(unit)
        const taken = Math.min(steps, before.strength)
        const after = reducedFace(before, taken)
        this.updateArmyDisplay(unit.playerId, before, after)
        if (after) {
            this.setFace(unit, after)
        } else {
            this.eliminate(unit)
        }
        return { unitId: unit.id, steps: taken, eliminated: !after, face: before }
    }

    private updateArmyDisplay(playerId: string, before: Face, after: Face | undefined) {
        const display = this.getPlayerState(playerId).armyDisplay
        assertExists(display, `The army display of ${playerId} is not set`)
        const index = display.findIndex((face) => sameFace(face, before))
        assert(
            index >= 0,
            `The army display of ${playerId} has no unit like the one that took a loss`
        )
        if (after) {
            display.splice(index, 1, { ...after })
        } else {
            display.splice(index, 1)
        }
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

    /** Rule 13: a loss from an artillery-led attack cannot be the one that breaks an army. */
    loseMorale(playerId: string, points: number, fromArtillery = false): number {
        const player = this.getPlayerState(playerId)
        if (player.morale - points >= 1 || fromArtillery) {
            return this.wearDown(player, points)
        }
        const lost = player.morale
        player.moraleLost += lost
        player.morale = 0
        return lost
    }

    failGuardAttack(playerId: string): MoralePenalty {
        this.getPlayerState(playerId).guardAttackForfeited = true
        return {
            playerId,
            kind: MoralePenaltyKind.GuardAttackDefeated,
            moraleLost: this.loseMorale(playerId, FAILED_GUARD_ATTACK_PENALTY)
        }
    }

    isDemoralized(playerId: string): boolean {
        return this.getPlayerState(playerId).morale <= 0
    }

    detach(unit: ProjectedUnit) {
        unit.commanderId = undefined
    }

    /** Rules 11 and 12: a corps beaten back or retreating keeps only one of the units that were in it. */
    detachAllBut(kept: ProjectedUnit, corps: readonly ProjectedUnit[]) {
        for (const unit of corps) {
            if (unit !== kept) {
                this.detach(unit)
            }
        }
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
