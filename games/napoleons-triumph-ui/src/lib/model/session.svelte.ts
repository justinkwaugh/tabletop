import { GameSession } from '@tabletop/frontend-components'
import type { StagedSelectionState } from '@tabletop/frontend-components'
import { assertExists } from '@tabletop/common'
import {
    ActionType,
    Advance,
    AssignLosses,
    Attach,
    ChooseSide,
    CommandKind,
    CounterAttack,
    DETACHMENT_REACH,
    DeclareAttack,
    DeclareDefense,
    DeclareFeint,
    DeployArmy,
    EndTurn,
    HydratedNapoleonsTriumphGameState,
    MAX_FRENCH_DETACHMENTS,
    MachineState,
    Move,
    Occupy,
    PassBid,
    PlaceBid,
    PressAttack,
    Regroup,
    Retreat,
    SANTON_LOCALE,
    Side,
    ThreatenAttack,
    UnitType,
    canStillMove,
    commanderCanCommand,
    commandersOf,
    deployArmy,
    independentCommandsLeft,
    isLegal,
    mayEnter,
    suggestedDeployment,
    validateAttach,
    whyIllegal,
    type Commander,
    type Deployment,
    type Face,
    type FeintEnd,
    type MoveOrder,
    type NapoleonsTriumphProjectedState,
    type Position,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import { shadeOf, type ArmyColors } from '$lib/utils/armyColors.js'
import { BoardView, viewRotation } from '$lib/utils/boardView.js'
import { layoutPieces, type GroupSprite, type PieceGroup } from '$lib/utils/pieceLayout.js'
import {
    AttackWidth,
    advanceSelection,
    attackerSelection,
    defenceSelection,
    emptyBattleSelections,
    hasManualBattleSelection,
    retreatSelection,
    undoBattleSelection,
    type BattleSelections
} from './battleSelection.js'
import {
    StageKind,
    battleStageOf,
    committedRoles,
    pickUnit,
    type BattleRole,
    type BattleStage
} from './battleStage.js'
import { commandSelection, type CommandSelectionValues } from './commandSelection.js'
import {
    editedDeployment,
    recordSetupEdit,
    setupSelection,
    toggleSetupUnit,
    undoSetupSelection,
    type SetupSelection
} from './setupSelection.js'
import { TargetKind, moveTargets, type MoveTarget } from './targets.js'

export interface Reinforcement {
    commander: Commander
    units: ProjectedUnit[]
}

export interface BlockMark {
    pickable: boolean
    role?: BattleRole
    dimmed: boolean
    spent: boolean
}

export class NapoleonsTriumphGameSession extends GameSession<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> {
    private selection: StagedSelectionState<CommandSelectionValues> = $state(
        commandSelection.empty()
    )
    private setup: SetupSelection = $state(setupSelection.empty())
    private battle: BattleSelections = $state(emptyBattleSelections())

    plannedOrder: MoveOrder | undefined = $state()

    zoom = $state(0.3)

    boardView: BoardView = $state(BoardView.North)

    boardRotation = $derived(viewRotation(this.boardView))

    attack = $derived(this.gameState.attack)

    myPlayerId = $derived(this.myPlayer?.id)

    mySide: Side | undefined = $derived(
        this.myPlayerId ? this.gameState.findPlayerState(this.myPlayerId)?.side : undefined
    )

    canAct = $derived(this.isMyTurn && !this.isViewingHistory)

    isCommanding = $derived(this.canAct && this.gameState.machineState === MachineState.Commanding)

    isAuction = $derived(
        this.gameState.machineState === MachineState.Bidding ||
            this.gameState.machineState === MachineState.ChoosingSide
    )

    isDeploying = $derived(this.canAct && this.validActionTypes.includes(ActionType.DeployArmy))

    setupUnitId = $derived(setupSelection.value(this.setup, 'unit'))

    deployment: Deployment | undefined = $derived.by(() => {
        const side = this.mySide
        if (!this.isDeploying || !side) {
            return undefined
        }
        return editedDeployment(this.setup) ?? suggestedDeployment(this.gameState, side)
    })

    setupPreview: { state?: HydratedNapoleonsTriumphGameState; problem?: string } = $derived.by(
        () => {
            const playerId = this.myPlayerId
            const deployment = this.deployment
            if (!deployment || !playerId) {
                return {}
            }
            const preview = this.copyOfState()
            const problem = whyIllegal(() => deployArmy(preview, playerId, deployment))
            return problem === undefined ? { state: preview } : { problem }
        }
    )

    battleLocales: number[] = $derived.by(() => {
        const attack = this.attack
        if (!attack) {
            return []
        }
        const map = this.gameState.map
        return [
            map.approach(attack.attackApproach).locale,
            map.approach(attack.defenseApproach).locale
        ]
    })

    sprites: GroupSprite[] = $derived(
        layoutPieces(this.setupPreview.state ?? this.gameState, {
            rotation: this.boardRotation,
            looseLocales: this.battleLocales
        })
    )

    battleStage: BattleStage | undefined = $derived.by(() => {
        const attack = this.attack
        return attack && this.canAct
            ? battleStageOf(this.gameState, attack, this.battle, this.plannedOrder)
            : undefined
    })

    private battleRoles: Record<string, BattleRole> = $derived.by(() => {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat) {
            return stage.roles
        }
        return { ...(this.attack ? committedRoles(this.attack) : {}), ...(stage?.roles ?? {}) }
    })

    /** The cavalry road move the acting player may still carry on (rule 11). */
    march = $derived(this.isCommanding ? this.gameState.roadMarch : undefined)

    private marchGroupKey: string | undefined = $derived.by(() => {
        const march = this.march
        return march
            ? this.sprites.find((sprite) =>
                  sprite.group.units.some((unit) => march.unitIds.includes(unit.id))
              )?.group.key
            : undefined
    })

    selectedGroupKey = $derived(
        this.isCommanding
            ? (commandSelection.value(this.selection, 'group') ?? this.marchGroupKey)
            : undefined
    )

    ridingOn = $derived(
        this.marchGroupKey !== undefined && this.selectedGroupKey === this.marchGroupKey
    )

    reinforcements: Reinforcement[] = $derived.by(() => {
        const side = this.mySide
        if (!side || !this.isCommanding) {
            return []
        }
        return commandersOf(side)
            .map((definition) => this.gameState.commander(definition.id))
            .filter(
                (commander) =>
                    !commander.eliminated &&
                    commander.position === undefined &&
                    mayEnter(this.gameState, commander.id)
            )
            .map((commander) => ({ commander, units: this.gameState.corpsUnits(commander.id) }))
    })

    private selectedReinforcement: PieceGroup | undefined = $derived.by(() => {
        const key = this.selectedGroupKey
        const reinforcement = this.reinforcements.find(
            (candidate) => reinforcementKey(candidate.commander.id) === key
        )
        const playerId = this.myPlayerId
        if (!reinforcement || !playerId) {
            return undefined
        }
        return {
            key: reinforcementKey(reinforcement.commander.id),
            playerId,
            commander: reinforcement.commander,
            units: reinforcement.units
        }
    })

    selectedSprite: GroupSprite | undefined = $derived(
        this.sprites.find((sprite) => sprite.group.key === this.selectedGroupKey)
    )

    selectedGroup: PieceGroup | undefined = $derived(
        this.selectedSprite?.group ?? this.selectedReinforcement
    )

    pickedUnitIds: string[] = $derived.by(() => {
        const group = this.selectedGroup
        if (!group) {
            return []
        }
        if (this.ridingOn) {
            return [...(this.march?.unitIds ?? [])]
        }
        const picked = commandSelection.value(this.selection, 'units')
        return picked
            ? picked.filter((id) => group.units.some((unit) => unit.id === id))
            : this.unitsPickedUpWith(group)
    })

    commandOptions: CommandKind[] = $derived.by(() => {
        const group = this.selectedGroup
        const playerId = this.myPlayerId
        if (!group || !playerId || this.pickedUnitIds.length === 0 || this.ridingOn) {
            return []
        }
        const state = this.gameState
        const commander = group.commander
        const canCommand = commander !== undefined && commanderCanCommand(state, commander)
        const whole = this.pickedUnitIds.length === group.units.length
        const detachable = commander === undefined || group.units.length > 1
        const single =
            this.pickedUnitIds.length === 1 &&
            detachable &&
            independentCommandsLeft(state, playerId) > 0
        return [
            ...(canCommand ? [CommandKind.Corps] : []),
            ...(canCommand && !whole && commander.position !== undefined
                ? [CommandKind.Detach]
                : []),
            ...(single ? [CommandKind.Unit] : [])
        ]
    })

    commandKind: CommandKind | undefined = $derived.by(() => {
        const chosen = commandSelection.value(this.selection, 'command')
        return chosen !== undefined && this.commandOptions.includes(chosen)
            ? chosen
            : this.commandOptions[0]
    })

    order: MoveOrder | undefined = $derived.by(() => {
        const group = this.selectedGroup
        const kind = this.commandKind
        const march = this.march
        if (this.ridingOn && march) {
            return {
                kind: march.kind,
                commanderId: march.commanderId,
                unitIds: [...march.unitIds],
                continues: true
            }
        }
        if (!group || kind === undefined) {
            return undefined
        }
        return kind === CommandKind.Unit
            ? { kind, unitIds: this.pickedUnitIds }
            : { kind, commanderId: group.commander?.id, unitIds: this.pickedUnitIds }
    })

    /** Guard infantry in the order that can be shown to announce a Guard Attack (rule 15). */
    guardUnitId: string | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!playerId || this.gameState.getPlayerState(playerId).guardAttackForfeited) {
            return undefined
        }
        return this.pickedUnitIds.find((id) => this.gameState.unit(id).face?.guard === true)
    })

    guardAttack = $derived(
        commandSelection.value(this.selection, 'guardAttack') === true &&
            this.guardUnitId !== undefined
    )

    private detachmentTargets: MoveTarget[] = $derived.by(() => {
        const deployment = this.deployment
        const unitId = this.setupUnitId
        const playerId = this.myPlayerId
        if (!deployment || !unitId || !playerId || this.mySide !== Side.French) {
            return []
        }
        const corps = deployment.corps.find((entry) => entry.unitIds.includes(unitId))
        const home =
            corps && !corps.offMap ? this.gameState.map.setupLocale(corps.commanderId) : undefined
        const alreadyDetached = deployment.detachments.some((entry) => entry.unitId === unitId)
        if (
            !home ||
            (!alreadyDetached && deployment.detachments.length >= MAX_FRENCH_DETACHMENTS)
        ) {
            return []
        }
        const map = this.gameState.map
        return map.allLocales
            .filter((locale) => (map.distance(home.id, locale.id) ?? Infinity) <= DETACHMENT_REACH)
            .flatMap((locale): Position[] => [
                { locale: locale.id },
                ...map
                    .passableApproachesOf(locale.id)
                    .map((approach) => ({ locale: locale.id, approach: approach.id }))
            ])
            .filter((position) => this.detachmentLegal(deployment, unitId, position, playerId))
            .map((position) => {
                const kind =
                    position.approach === undefined ? TargetKind.Reserve : TargetKind.Approach
                return {
                    key: `${kind}:${position.locale}:${position.approach ?? 'r'}`,
                    kind,
                    position
                }
            })
    })

    targets: MoveTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        const side = this.mySide
        const stage = this.battleStage
        if (this.isDeploying) {
            return this.detachmentTargets
        }
        if (stage?.kind === StageKind.Retreat) {
            return [...stage.plan.room.keys()].map((locale) => ({
                key: `${TargetKind.Retreat}:${locale}`,
                kind: TargetKind.Retreat,
                position: { locale }
            }))
        }
        if (!this.order || !playerId || !side) {
            return []
        }
        const entries = this.gameState.map.entries(side).map((entry) => entry.id)
        return moveTargets(this.gameState, playerId, this.order, entries)
    })

    armyColors(playerId: string): ArmyColors {
        const block = this.colors.getPlayerUiColor(playerId)
        return { block, shade: shadeOf(block), ink: this.colors.getPlayerTextColorValue(playerId) }
    }

    visibleFace(unit: ProjectedUnit): Face | undefined {
        return unit.playerId === this.myPlayerId ? (unit.face ?? unit.shown) : unit.shown
    }

    blockMark(unit: ProjectedUnit, groupKey: string): BlockMark {
        const fighting = this.attack !== undefined
        const eligible = this.battleStage?.pickableIds.includes(unit.id) === true
        const role = this.battleRoles[unit.id]
        const leftOut = groupKey === this.selectedGroupKey && !this.pickedUnitIds.includes(unit.id)
        return {
            pickable: eligible && !this.busy,
            role,
            dimmed: leftOut || (fighting && !eligible && role === undefined),
            spent:
                !fighting && unit.movesThisTurn !== undefined && unit.playerId === this.myPlayerId
        }
    }

    attachOptions(unit: ProjectedUnit): Commander[] {
        const playerId = this.myPlayerId
        if (!this.isCommanding || !playerId) {
            return []
        }
        return this.gameState
            .commandersOf(unit.playerId)
            .filter((commander) =>
                isLegal(() => validateAttach(this.gameState, playerId, commander.id, unit.id))
            )
    }

    canSelect(group: PieceGroup): boolean {
        return this.isCommanding && !this.busy && group.playerId === this.myPlayerId
    }

    hasCommanded(group: PieceGroup): boolean {
        return (
            this.isCommanding &&
            group.playerId === this.myPlayerId &&
            group.commander?.commandsThisTurn !== undefined
        )
    }

    selectGroup(group: PieceGroup) {
        if (!this.canSelect(group)) {
            return
        }
        if (commandSelection.value(this.selection, 'group') === group.key) {
            this.stageCommand(commandSelection.empty())
            return
        }
        this.pickUp(group.key)
    }

    selectReinforcement(commanderId: string) {
        const reinforcement = this.reinforcements.find(
            (candidate) => candidate.commander.id === commanderId
        )
        if (reinforcement) {
            this.pickUp(reinforcementKey(commanderId))
        }
    }

    togglePickedUnit(unitId: string) {
        const group = this.selectedGroup
        if (!group || this.ridingOn || !group.units.some((unit) => unit.id === unitId)) {
            return
        }
        const picked = this.pickedUnitIds.includes(unitId)
            ? this.pickedUnitIds.filter((id) => id !== unitId)
            : group.commander
              ? [...this.pickedUnitIds, unitId]
              : [unitId]
        this.stageCommand(commandSelection.set(this.selection, 'units', picked, 'manual'))
    }

    chooseCommand(kind: CommandKind) {
        if (this.commandOptions.includes(kind)) {
            this.stageCommand(commandSelection.set(this.selection, 'command', kind, 'manual'))
        }
    }

    toggleGuardAttack() {
        this.stageCommand(
            this.guardAttack
                ? commandSelection.clearFrom(this.selection, 'guardAttack')
                : commandSelection.set(this.selection, 'guardAttack', true, 'manual')
        )
    }

    clearSelection() {
        this.stageCommand(commandSelection.empty())
    }

    async chooseTarget(target: MoveTarget) {
        if (this.busy) {
            return
        }
        if (this.isDeploying) {
            this.detachTo(target.position)
            return
        }
        if (target.kind === TargetKind.Retreat) {
            this.sendRetreatTo(target.position.locale)
            return
        }
        const order = this.order
        if (!order || !this.targets.some((candidate) => candidate.key === target.key)) {
            return
        }
        if (target.kind === TargetKind.Attack) {
            await this.threaten(target.position.approach, order)
            return
        }
        this.stageCommand(commandSelection.empty())
        await this.applyAction(
            this.createPlayerAction(Move, {
                order: { ...order, road: target.road, entryId: target.entryId },
                to: target.position
            })
        )
    }

    async attach(commanderId: string, unitId: string) {
        if (!this.validActionTypes.includes(ActionType.Attach)) {
            return
        }
        this.stageCommand(commandSelection.empty())
        await this.applyAction(this.createPlayerAction(Attach, { commanderId, unitId }))
    }

    async endTurn() {
        if (!this.validActionTypes.includes(ActionType.EndTurn)) {
            return
        }
        this.stageCommand(commandSelection.empty())
        await this.applyAction(this.createPlayerAction(EndTurn, {}))
    }

    async placeBid(amount: number) {
        if (this.validActionTypes.includes(ActionType.PlaceBid)) {
            await this.applyAction(this.createPlayerAction(PlaceBid, { amount }))
        }
    }

    async passBid() {
        if (this.validActionTypes.includes(ActionType.PassBid)) {
            await this.applyAction(this.createPlayerAction(PassBid, {}))
        }
    }

    async chooseSide(side: Side) {
        if (this.validActionTypes.includes(ActionType.ChooseSide)) {
            await this.applyAction(this.createPlayerAction(ChooseSide, { side }))
        }
    }

    pickSetupUnit(unitId: string) {
        this.stageSetup(toggleSetupUnit(this.setup, unitId))
    }

    assignPickedTo(commanderId: string) {
        const unitId = this.setupUnitId
        if (!unitId) {
            return
        }
        this.editSetup((deployment) => ({
            ...deployment,
            corps: deployment.corps.map((corps) => ({
                ...corps,
                unitIds:
                    corps.commanderId === commanderId
                        ? [...corps.unitIds.filter((id) => id !== unitId), unitId]
                        : corps.unitIds.filter((id) => id !== unitId)
            })),
            detachments: deployment.detachments.filter((entry) => entry.unitId !== unitId)
        }))
    }

    recallDetachment(unitId: string) {
        this.editSetup((deployment) => ({
            ...deployment,
            detachments: deployment.detachments.filter((entry) => entry.unitId !== unitId)
        }))
    }

    cycleCorpsStance(commanderId: string) {
        const locale = this.gameState.map.setupLocale(commanderId)
        assertExists(locale, `${commanderId} has no set-up locale`)
        const stances = [
            undefined,
            ...this.gameState.map.passableApproachesOf(locale.id).map((approach) => approach.id)
        ]
        this.editSetup((deployment) => ({
            ...deployment,
            corps: deployment.corps.map((corps) =>
                corps.commanderId === commanderId
                    ? {
                          ...corps,
                          approach: stances[(stances.indexOf(corps.approach) + 1) % stances.length]
                      }
                    : corps
            )
        }))
    }

    toggleCorpsOffMap(commanderId: string) {
        this.editSetup((deployment) => ({
            ...deployment,
            corps: deployment.corps.map((corps) => {
                if (corps.commanderId !== commanderId) {
                    return corps
                }
                return corps.offMap
                    ? { commanderId: corps.commanderId, unitIds: corps.unitIds }
                    : {
                          commanderId: corps.commanderId,
                          unitIds: corps.unitIds,
                          offMap: true as const
                      }
            })
        }))
    }

    nameFixedBattery(unitId: string) {
        this.editSetup((deployment) => ({ ...deployment, fixedBattery: { unitId } }))
    }

    async commitSetup() {
        const deployment = this.deployment
        if (
            deployment &&
            this.setupPreview.state &&
            this.validActionTypes.includes(ActionType.DeployArmy)
        ) {
            await this.applyAction(
                this.createPlayerAction(DeployArmy, { deployment: $state.snapshot(deployment) })
            )
        }
    }

    async pickBattleUnit(unitId: string) {
        const stage = this.battleStage
        if (!stage?.pickableIds.includes(unitId)) {
            return
        }
        if (stage.kind === StageKind.OddLoss) {
            await this.applyAction(
                this.createPlayerAction(AssignLosses, { allocation: { [unitId]: 1 } })
            )
            return
        }
        this.stageBattle(pickUnit(this.gameState, stage, this.battle, unitId))
    }

    planRetreat() {
        if (this.battleStage?.kind === StageKind.Defence && !this.battleStage.forced) {
            this.stageBattle({
                defence: defenceSelection.set(this.battle.defence, 'retreating', true, 'manual')
            })
        }
    }

    cycleRetreatLoss(unitId: string) {
        const stage = this.battleStage
        if (stage?.kind !== StageKind.Retreat) {
            return
        }
        const strength = this.gameState.unit(unitId).face?.strength ?? 0
        const next = ((stage.plan.losses[unitId] ?? 0) + 1) % (strength + 1)
        const { [unitId]: _previous, ...others } = stage.plan.losses
        const losses = next === 0 ? others : { ...others, [unitId]: next }
        this.stageBattle({
            retreat: retreatSelection.set(this.battle.retreat, 'losses', losses, 'manual')
        })
    }

    keepInCorps(commanderId: string, unitId: string) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat) {
            const kept = { ...stage.plan.kept, [commanderId]: unitId }
            this.stageBattle({
                retreat: retreatSelection.set(this.battle.retreat, 'kept', kept, 'manual')
            })
        }
    }

    chooseAttackCommand(kind: CommandKind) {
        this.stageBattle({
            attackers: attackerSelection.set(this.battle.attackers, 'command', kind, 'manual')
        })
    }

    chooseAttackWidth(width: AttackWidth) {
        this.stageBattle({
            attackers: attackerSelection.set(this.battle.attackers, 'width', width, 'manual')
        })
    }

    chooseStruckLeader(unitId: string) {
        this.stageBattle({
            attackers: attackerSelection.set(
                this.battle.attackers,
                'struckLeader',
                unitId,
                'manual'
            )
        })
    }

    toggleCommanderStays(commanderId: string) {
        const stage = this.battleStage
        if (stage?.kind !== StageKind.Advance) {
            return
        }
        const staying = stage.commanders
            .filter((entry) => !entry.goes !== (entry.commanderId === commanderId))
            .map((entry) => entry.commanderId)
        this.stageBattle({
            advance: advanceSelection.set(
                this.battle.advance,
                'commandersStaying',
                staying,
                'manual'
            )
        })
    }

    async declareDefense() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Defence && stage.defenders.length > 0 && !stage.problem) {
            await this.applyAction(
                this.createPlayerAction(DeclareDefense, {
                    unitIds: stage.defenders,
                    leaderIds: stage.leaders
                })
            )
        }
    }

    async commitRetreat() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat && stage.plan.lossesValid) {
            const { losses, destinations, kept } = stage.plan
            await this.applyAction(
                this.createPlayerAction(Retreat, {
                    losses: { ...losses },
                    destinations: { ...destinations },
                    kept: { ...kept }
                })
            )
        }
    }

    async feint(end: FeintEnd) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Feint && stage.orders && stage.ends.includes(end)) {
            await this.applyAction(
                this.createPlayerAction(DeclareFeint, { orders: stage.orders, end })
            )
        }
    }

    async pressAttack() {
        if (this.battleStage?.kind === StageKind.Feint && this.battleStage.canPress) {
            await this.applyAction(this.createPlayerAction(PressAttack, {}))
        }
    }

    async declareAttack() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Declaration && stage.orders && !stage.problem) {
            await this.applyAction(
                this.createPlayerAction(DeclareAttack, {
                    orders: stage.orders,
                    wide: stage.wide,
                    leaderIds: stage.leaders,
                    targetLeaderId: stage.target
                })
            )
        }
    }

    async moveIn() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Occupation && stage.orders && stage.mayMoveIn) {
            await this.applyAction(this.createPlayerAction(Occupy, { orders: stage.orders }))
        }
    }

    async rideIn() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Occupation && stage.roadOrders) {
            await this.applyAction(this.createPlayerAction(Occupy, { orders: stage.roadOrders }))
        }
    }

    async holdGuns() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Occupation && stage.orders && stage.gunsMayStay) {
            await this.applyAction(
                this.createPlayerAction(Occupy, { orders: stage.orders, artilleryStays: true })
            )
        }
    }

    async counterAttack() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Counter && !stage.problem) {
            await this.applyAction(
                this.createPlayerAction(CounterAttack, { unitIds: stage.counterAttackers })
            )
        }
    }

    async takeExcessLosses() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.ExcessLosses && stage.assigned === stage.amount) {
            await this.applyAction(
                this.createPlayerAction(AssignLosses, { allocation: stage.losses })
            )
        }
    }

    async regroup() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Regroup) {
            const keep = Object.fromEntries(
                stage.corps.map((entry) => [entry.commanderId, entry.keptId])
            )
            await this.applyAction(this.createPlayerAction(Regroup, { keep }))
        }
    }

    async advance() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Advance && stage.advancing.length > 0) {
            const commanderIds = stage.commanders
                .filter((entry) => entry.goes)
                .map((entry) => entry.commanderId)
            await this.applyAction(
                this.createPlayerAction(Advance, { unitIds: stage.advancing, commanderIds })
            )
        }
    }

    hasManualSelection(): boolean {
        if (this.isDeploying) {
            return setupSelection.hasManual(this.setup)
        }
        if (this.battleStage) {
            return hasManualBattleSelection(this.battle)
        }
        return this.isCommanding && commandSelection.hasManual(this.selection)
    }

    override async undo() {
        if (!this.hasManualSelection()) {
            await super.undo()
        } else if (this.isDeploying) {
            this.setup = undoSetupSelection(this.setup)
        } else if (this.battleStage) {
            this.battle = undoBattleSelection(this.battle)
        } else {
            this.selection = commandSelection.undo(this.selection)
        }
    }

    resetAction() {
        this.selection = commandSelection.empty()
        this.setup = setupSelection.empty()
        this.battle = emptyBattleSelections()
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    private copyOfState(): HydratedNapoleonsTriumphGameState {
        return new HydratedNapoleonsTriumphGameState(structuredClone(this.gameState.dehydrate()))
    }

    private pickUp(groupKey: string) {
        this.stageCommand(
            commandSelection.set(commandSelection.empty(), 'group', groupKey, 'manual')
        )
    }

    private unitsPickedUpWith(group: PieceGroup): string[] {
        const movable = group.units.filter((unit) => canStillMove(this.gameState, unit))
        return (group.commander ? movable : movable.slice(0, 1)).map((unit) => unit.id)
    }

    private async threaten(approach: number | undefined, order: MoveOrder) {
        if (approach === undefined || !this.validActionTypes.includes(ActionType.ThreatenAttack)) {
            return
        }
        const guardUnitId = this.guardAttack ? this.guardUnitId : undefined
        this.plannedOrder = order
        this.stageCommand(commandSelection.empty())
        await this.applyAction(
            this.createPlayerAction(
                ThreatenAttack,
                guardUnitId ? { approach, guardUnitId } : { approach }
            )
        )
    }

    private sendRetreatTo(locale: number) {
        const stage = this.battleStage
        if (stage?.kind !== StageKind.Retreat || !stage.plan.room.has(locale)) {
            return
        }
        const moved = stage.alone ? [stage.alone] : stage.plan.survivors.map((unit) => unit.id)
        const destinations = {
            ...stage.plan.destinations,
            ...Object.fromEntries(moved.map((id) => [id, locale]))
        }
        this.stageBattle({
            retreat: retreatSelection.set(
                this.battle.retreat,
                'destinations',
                destinations,
                'manual'
            )
        })
    }

    private detachTo(position: Position) {
        const unitId = this.setupUnitId
        if (!unitId) {
            return
        }
        this.editSetup((deployment) => ({
            ...deployment,
            detachments: [
                ...deployment.detachments.filter((entry) => entry.unitId !== unitId),
                { unitId, position }
            ]
        }))
    }

    private detachmentLegal(
        deployment: Deployment,
        unitId: string,
        position: Position,
        playerId: string
    ): boolean {
        const candidate: Deployment = {
            ...deployment,
            detachments: [
                ...deployment.detachments.filter((entry) => entry.unitId !== unitId),
                { unitId, position }
            ],
            fixedBattery:
                deployment.fixedBattery?.unitId === unitId ? undefined : deployment.fixedBattery
        }
        return isLegal(() => deployArmy(this.copyOfState(), playerId, this.withBattery(candidate)))
    }

    /** Rule 6, step 9: a French set-up with artillery on the map always names a fixed battery, on an approach unless it is on the Santon. */
    private withBattery(deployment: Deployment): Deployment {
        if (this.mySide !== Side.French) {
            return deployment
        }
        const map = this.gameState.map
        const placed = deployment.corps
            .filter((corps) => !corps.offMap)
            .flatMap((corps) => corps.unitIds.map((unitId) => ({ unitId, corps })))
            .filter(({ unitId }) => this.gameState.unit(unitId).face?.type === UnitType.Artillery)
        const current = placed.find(({ unitId }) => unitId === deployment.fixedBattery?.unitId)
        const chosen = current ?? placed[0]
        if (!chosen) {
            return { ...deployment, fixedBattery: undefined }
        }
        const detachment = deployment.detachments.find((entry) => entry.unitId === chosen.unitId)
        const locale = detachment?.position.locale ?? map.setupLocale(chosen.corps.commanderId)?.id
        const standing = detachment ? detachment.position.approach : chosen.corps.approach
        if (locale === undefined) {
            return { ...deployment, fixedBattery: undefined }
        }
        if (this.gameState.santon && locale === SANTON_LOCALE && standing === undefined) {
            return { ...deployment, fixedBattery: { unitId: chosen.unitId } }
        }
        const approaches = map.passableApproachesOf(locale).map((approach) => approach.id)
        const wanted = current ? deployment.fixedBattery?.approach : undefined
        const approach =
            wanted !== undefined && approaches.includes(wanted)
                ? wanted
                : (standing ?? approaches[0])
        return {
            ...deployment,
            fixedBattery: {
                unitId: chosen.unitId,
                approach: standing === approach ? undefined : approach
            }
        }
    }

    private editSetup(change: (deployment: Deployment) => Deployment) {
        const deployment = this.deployment
        if (deployment) {
            const edited = this.withBattery(change(structuredClone($state.snapshot(deployment))))
            this.stageSetup(recordSetupEdit(this.setup, edited))
        }
    }

    // The shared session ignores an action offered while it settles an earlier action or Undo, and its next publish resets these selections.
    private stageCommand(selection: StagedSelectionState<CommandSelectionValues>) {
        if (!this.busy) {
            this.selection = selection
        }
    }

    private stageSetup(setup: SetupSelection) {
        if (!this.busy) {
            this.setup = setup
        }
    }

    private stageBattle(selections: Partial<BattleSelections>) {
        if (!this.busy) {
            this.battle = { ...this.battle, ...selections }
        }
    }
}

export function reinforcementKey(commanderId: string): string {
    return `reinforcement|${commanderId}`
}
