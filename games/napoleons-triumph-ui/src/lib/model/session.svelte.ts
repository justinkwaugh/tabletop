import { GameSession, type TitlePreferences } from '@tabletop/frontend-components'
import { assert, assertExists, type Point } from '@tabletop/common'
import {
    ActionType,
    Advance,
    AssignLosses,
    Attach,
    ChooseSide,
    CounterAttack,
    DeclareAttack,
    DeclareDefense,
    DeclareFeint,
    DeployArmy,
    EndTurn,
    MachineState,
    Move,
    NapoleonsTriumphPreferenceDefinition,
    Occupy,
    PassBid,
    PlaceBid,
    PressAttack,
    Regroup,
    Retreat,
    ThreatenAttack,
    canStillMove,
    isLegal,
    suggestedDeployment,
    validateAttach,
    type CommandKind,
    type Commander,
    type Deployment,
    type Face,
    type FeintEnd,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type NapoleonsTriumphPreferences,
    type NapoleonsTriumphProjectedState,
    type ProjectedUnit,
    type Side
} from '@tabletop/napoleons-triumph'
import { shadeOf, type ArmyColors } from '$lib/utils/armyColors.js'
import { BoardView, viewRotation } from '$lib/utils/boardView.js'
import { commandDiscs } from '$lib/utils/commandTrack.js'
import {
    arrowsToKeepClear,
    flagMarks,
    flagScale,
    type FlagBearer,
    type FlagMark,
    type FlagView
} from '$lib/utils/flagLayout.js'
import { topmostAt } from '$lib/utils/blockShape.js'
import {
    heldApproaches,
    layoutPieces,
    type GroupSprite,
    type HeldApproach,
    type PieceGroup
} from '$lib/utils/pieceLayout.js'
import { showsArmyOf } from './armyInView.js'
import {
    AttackWidth,
    StageKind,
    chooseFeint,
    chooseRetreat,
    emptyBattleSelections,
    hasManualBattleSelection,
    setAttackCommand,
    setAttackWidth,
    undoBattleSelection,
    type BattleSelections
} from './battleSelection.js'
import {
    battleLocalesOf,
    battleStageOf,
    commandersGoing,
    cycleLoss,
    keepWithCommander,
    keptByCommander,
    pickUnit,
    rolesShown,
    sendRetreatTo,
    toggleStaying,
    type BattleRole,
    type BattleStage
} from './battleStage.js'
import {
    blockMarkOf,
    shownMovedInUnitStrip,
    type BlockMark,
    type BlockMarkContext
} from './blockMark.js'
import {
    chooseCorpsUnit,
    chosenCommandOf,
    chosenUnitsOf,
    guardAttackAnnounced,
    hasManualCommandSelection,
    noCommandSelection,
    pickedUpOf,
    setCommand,
    setDetachedUnit,
    setGuardAttack,
    setPickedUp,
    undoCommandSelection,
    unitsPickedUpWith,
    type CommandSelection
} from './commandSelection.js'
import {
    previewDeployment,
    settleFixedBattery,
    mayNameFixedBattery,
    unitTargets,
    withBatteryNamed,
    withCorpsOffMapToggled,
    withDetachmentRecalled,
    stanceTargets,
    withCorpsStance,
    withUnitAssigned,
    withUnitSentTo,
    type DeploymentPreview
} from './deploymentEdits.js'
import { guardUnitToAnnounce, targetsOfGuardAttack } from './guardAttack.js'
import type { HistoryLine } from './historyChapters.js'
import {
    moveCommandOptions,
    moveOrder,
    reinforcementsOf,
    rideOnOrder,
    type Reinforcement
} from './moveCommands.js'
import {
    moveReplayOf,
    moveReplayScene,
    type MoveReplay,
    type MoveReplayScene
} from './moveReplay.js'
import {
    editedDeployment,
    hasManualSetupSelection,
    noSetupSelection,
    pickedSetupCorps,
    pickedSetupUnit,
    recordSetupEdit,
    toggleSetupCorps,
    toggleSetupUnit,
    undoSetupSelection,
    type SetupSelection
} from './setupSelection.js'
import {
    TargetKind,
    moveTargets,
    retreatTargets,
    threatenedApproaches,
    type AttackTarget,
    type MoveTarget
} from './targets.js'

type ZoomSource = () => number | undefined

const ZOOM_BEFORE_THE_TABLE_IS_DRAWN = 0.3

export class NapoleonsTriumphGameSession extends GameSession<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> {
    private selection: CommandSelection = $state(noCommandSelection())
    private setup: SetupSelection = $state(noSetupSelection())
    private battle: BattleSelections = $state(emptyBattleSelections())
    private readonly pickUpListeners = new Set<() => void>()

    private zoomSource: ZoomSource | undefined = $state.raw()

    zoom = $derived(this.zoomSource?.() ?? ZOOM_BEFORE_THE_TABLE_IS_DRAWN)

    boardView: BoardView = $state(BoardView.North)

    readonly preferences: TitlePreferences<typeof NapoleonsTriumphPreferences> =
        this.createPreferences(NapoleonsTriumphPreferenceDefinition)

    darkBorders = $derived(this.preferences.values.darkBorders)

    approachSymbolsShown = $state(false)

    boardRotation = $derived(viewRotation(this.boardView))

    attack = $derived(this.gameState.attack)

    myPlayerId = $derived(this.myPlayer?.id)

    mySide: Side | undefined = $derived(
        this.myPlayerId ? this.gameState.findPlayerState(this.myPlayerId)?.side : undefined
    )

    // Workaround: Admin mode names the acting player at once and fetches the full state afterwards, so for a moment the state on hand is one that hides that player's army, and the rules cannot be asked anything on their behalf.
    private readonly armyInView = $derived(
        this.myPlayerId === undefined || showsArmyOf(this.gameState, this.myPlayerId)
    )

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && this.armyInView)

    isCommanding = $derived(this.canAct && this.gameState.machineState === MachineState.Commanding)

    isAuction = $derived(
        this.gameState.machineState === MachineState.Bidding ||
            this.gameState.machineState === MachineState.ChoosingSide
    )

    isDeploying = $derived(this.canAct && this.validActionTypes.includes(ActionType.DeployArmy))

    setupUnitId = $derived(pickedSetupUnit(this.setup))

    setupCorpsId = $derived(pickedSetupCorps(this.setup))

    deployment: Deployment | undefined = $derived.by(() => {
        const side = this.mySide
        if (!this.isDeploying || !side) {
            return undefined
        }
        return editedDeployment(this.setup) ?? suggestedDeployment(this.gameState, side)
    })

    setupPreview: DeploymentPreview = $derived.by(() => {
        const playerId = this.myPlayerId
        const deployment = this.deployment
        return deployment && playerId ? previewDeployment(this.gameState, playerId, deployment) : {}
    })

    battleLocales: number[] = $derived(battleLocalesOf(this.gameState))

    sprites: GroupSprite[] = $derived(
        layoutPieces(this.setupPreview.state ?? this.gameState, {
            rotation: this.boardRotation,
            looseLocales: this.battleLocales
        })
    )

    commandDiscs: Point[] = $derived(commandDiscs(this.gameState))

    heldApproaches: HeldApproach[] = $derived(heldApproaches(this.sprites))

    flagView: FlagView = $derived({ rotation: this.boardRotation, scale: flagScale(this.zoom) })

    flags: FlagMark[] = $derived.by(() => {
        const arrowApproaches = [
            ...(this.attack ? [this.attack.attackApproach] : []),
            ...threatenedApproaches(this.targets)
        ]
        return flagMarks(
            this.sprites,
            this.flagView,
            arrowsToKeepClear(arrowApproaches, this.zoom),
            (group) => this.flagBearer(group, this.hasCommanded(group))
        )
    })

    private openedReplay: MoveReplay | undefined = $state.raw()

    moveReplay: MoveReplay | undefined = $derived.by(() => {
        const opened = this.openedReplay
        const stillRecorded = this.actions.some((action) => action.id === opened?.actionId)
        return stillRecorded ? opened : undefined
    })

    moveReplayScene: MoveReplayScene | undefined = $derived(
        this.moveReplay ? moveReplayScene(this.moveReplay, this.boardRotation) : undefined
    )

    battleStage: BattleStage | undefined = $derived.by(() => {
        const attack = this.attack
        return attack && this.canAct
            ? battleStageOf(this.gameState, attack, this.battle)
            : undefined
    })

    battleRoles: Record<string, BattleRole> = $derived(rolesShown(this.attack, this.battleStage))

    // Rule 11: cavalry that has taken a locale by road may ride on.
    private openRoadMarch = $derived(this.isCommanding ? this.gameState.roadMarch : undefined)

    private marchGroupKey: string | undefined = $derived.by(() => {
        const march = this.openRoadMarch
        return march
            ? this.sprites.find((sprite) =>
                  sprite.group.units.some((unit) => march.unitIds.includes(unit.id))
              )?.group.key
            : undefined
    })

    selectedGroupKey = $derived(
        this.isCommanding ? (pickedUpOf(this.selection)?.groupKey ?? this.marchGroupKey) : undefined
    )

    ridingOn = $derived(
        this.marchGroupKey !== undefined && this.selectedGroupKey === this.marchGroupKey
    )

    reinforcements: Reinforcement[] = $derived(
        this.mySide && this.isCommanding ? reinforcementsOf(this.gameState, this.mySide) : []
    )

    selectedSprite: GroupSprite | undefined = $derived.by(() => {
        const corpsId = this.setupCorpsId
        return this.isDeploying
            ? this.sprites.find(
                  ({ group }) => corpsId !== undefined && group.commander?.id === corpsId
              )
            : this.sprites.find((sprite) => sprite.group.key === this.selectedGroupKey)
    })

    selectedGroup: PieceGroup | undefined = $derived(
        this.selectedSprite?.group ??
            this.reinforcements.find((candidate) => candidate.key === this.selectedGroupKey)
    )

    pickedUnitIds: string[] = $derived.by(() => {
        const group = this.selectedGroup
        if (!group) {
            return []
        }
        if (this.ridingOn) {
            return [...(this.openRoadMarch?.unitIds ?? [])]
        }
        const chosen = chosenUnitsOf(this.selection)
        return chosen
            ? chosen.filter((id) => group.units.some((unit) => unit.id === id))
            : this.startingUnits(group)
    })

    wholeCorpsChosen = $derived(
        this.selectedGroup?.commander !== undefined &&
            !this.ridingOn &&
            chosenUnitsOf(this.selection) === undefined
    )

    commandOptions: CommandKind[] = $derived.by(() => {
        const group = this.selectedGroup
        const playerId = this.myPlayerId
        if (!group || !playerId || this.ridingOn) {
            return []
        }
        return moveCommandOptions(
            this.gameState,
            playerId,
            group,
            this.pickedUnitIds,
            this.wholeCorpsChosen
        )
    })

    commandKind: CommandKind | undefined = $derived.by(() => {
        const chosen = chosenCommandOf(this.selection)
        return chosen !== undefined && this.commandOptions.includes(chosen)
            ? chosen
            : this.commandOptions[0]
    })

    order: MoveOrder | undefined = $derived.by(() => {
        const group = this.selectedGroup
        const kind = this.commandKind
        const march = this.openRoadMarch
        if (this.ridingOn && march) {
            return rideOnOrder(march)
        }
        return group && kind !== undefined ? moveOrder(kind, group, this.pickedUnitIds) : undefined
    })

    private orderTargets: MoveTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        const side = this.mySide
        if (!this.order || !playerId || !side) {
            return []
        }
        const entries = this.gameState.map.entries(side).map((entry) => entry.id)
        return moveTargets(this.gameState, playerId, this.order, entries)
    })

    guardUnitId: string | undefined = $derived(
        this.myPlayerId
            ? guardUnitToAnnounce(
                  this.gameState,
                  this.myPlayerId,
                  this.pickedUnitIds,
                  this.orderTargets
              )
            : undefined
    )

    guardAttack = $derived(guardAttackAnnounced(this.selection) && this.guardUnitId !== undefined)

    private setupTargets: MoveTarget[] = $derived.by(() => {
        const deployment = this.deployment
        const unitId = this.setupUnitId
        const corpsId = this.setupCorpsId
        const playerId = this.myPlayerId
        if (!deployment || !playerId) {
            return []
        }
        if (corpsId) {
            return stanceTargets(this.gameState.map, deployment, corpsId)
        }
        return unitId ? unitTargets(this.gameState, playerId, deployment, unitId) : []
    })

    targets: MoveTarget[] = $derived.by(() => {
        const stage = this.battleStage
        if (this.isDeploying) {
            return this.setupTargets
        }
        if (stage?.kind === StageKind.Retreat) {
            return retreatTargets(stage.plan.room.keys())
        }
        return this.guardAttack
            ? targetsOfGuardAttack(this.gameState, this.orderTargets)
            : this.orderTargets
    })

    private blockMarkContext: BlockMarkContext = $derived({
        viewerId: this.myPlayerId,
        viewingHistory: this.isViewingHistory,
        settling: this.busy,
        fighting: this.attack !== undefined,
        pickableIds: this.battleStage?.pickableIds ?? [],
        roles: this.battleRoles,
        selectedGroupKey: this.selectedGroupKey,
        pickedUnitIds: this.pickedUnitIds,
        ridingOn: this.ridingOn
    })

    armyColors(playerId: string): ArmyColors {
        const block = this.colors.getPlayerUiColor(playerId)
        return { block, shade: shadeOf(block), ink: this.colors.getPlayerTextColorValue(playerId) }
    }

    visibleFace(unit: ProjectedUnit): Face | undefined {
        return unit.playerId === this.myPlayerId ? (unit.face ?? unit.shown) : unit.shown
    }

    flagBearer(group: PieceGroup, hasCommanded: boolean): FlagBearer {
        return {
            colors: this.armyColors(group.playerId),
            visibleFaces: group.units.flatMap((unit) => this.visibleFace(unit) ?? []),
            hasCommanded
        }
    }

    blockMark(unit: ProjectedUnit, groupKey: string): BlockMark {
        return blockMarkOf(unit, groupKey, this.blockMarkContext)
    }

    movedInUnitStrip(unit: ProjectedUnit): boolean {
        return shownMovedInUnitStrip(unit, this.blockMarkContext)
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
        const own = !this.busy && group.playerId === this.myPlayerId
        return this.isDeploying ? own && group.commander !== undefined : own && this.isCommanding
    }

    selectGroup(group: PieceGroup) {
        if (!this.canSelect(group)) {
            return
        }
        if (this.isDeploying) {
            assertExists(group.commander, 'Only a corps is picked up during set-up')
            this.stageSetup(toggleSetupCorps(this.setup, group.commander.id))
        } else {
            this.stageCommand(
                pickedUpOf(this.selection)?.groupKey === group.key
                    ? noCommandSelection()
                    : setPickedUp({ groupKey: group.key })
            )
        }
        this.announcePickUp()
    }

    tapBlock(group: PieceGroup, unitId: string) {
        if (!this.canSelect(group)) {
            return
        }
        if (this.isDeploying) {
            this.selectGroup(group)
            return
        }
        if (this.selectedGroupKey === group.key) {
            this.togglePickedUnit(unitId)
        } else {
            this.stageCommand(
                setPickedUp(
                    group.commander
                        ? { groupKey: group.key }
                        : { groupKey: group.key, tappedUnitId: unitId }
                )
            )
            this.announcePickUp()
        }
    }

    mayChooseUnit(unit: ProjectedUnit): boolean {
        return !this.ridingOn && canStillMove(this.gameState, unit)
    }

    selectReinforcement(reinforcement: Reinforcement) {
        if (this.reinforcements.some((candidate) => candidate.key === reinforcement.key)) {
            this.stageCommand(setPickedUp({ groupKey: reinforcement.key }))
            this.announcePickUp()
        }
    }

    /** The table moves the view for pieces just picked up; it is told when, rather than watching the selection. */
    onPickUp(listener: () => void): () => void {
        this.pickUpListeners.add(listener)
        return () => {
            this.pickUpListeners.delete(listener)
        }
    }

    /** The zoom is the scaling wrapper's own state; the table says where to read it, so the session keeps no copy. */
    readZoomFrom(source: ZoomSource): () => void {
        this.zoomSource = source
        return () => {
            if (this.zoomSource === source) {
                this.zoomSource = undefined
            }
        }
    }

    togglePickedUnit(unitId: string) {
        const group = this.selectedGroup
        const unit = group?.units.find((candidate) => candidate.id === unitId)
        if (!group || !unit || !this.mayChooseUnit(unit)) {
            return
        }
        if (group.commander) {
            this.stageCommand(chooseCorpsUnit(this.selection, unitId, this.startingUnits(group)))
        } else if (this.pickedUnitIds.includes(unitId)) {
            this.stageCommand(noCommandSelection())
        } else {
            this.stageCommand(setDetachedUnit(this.selection, unitId))
        }
    }

    chooseCommand(kind: CommandKind) {
        if (kind !== this.commandKind && this.commandOptions.includes(kind)) {
            this.stageCommand(setCommand(this.selection, kind))
        }
    }

    toggleGuardAttack() {
        this.stageCommand(setGuardAttack(this.selection, !this.guardAttack))
    }

    clearSelection() {
        this.stageCommand(noCommandSelection())
    }

    async chooseTarget(target: MoveTarget) {
        if (this.busy || !this.targets.some((offered) => offered.key === target.key)) {
            return
        }
        if (this.isDeploying) {
            const corpsId = this.setupCorpsId
            if (corpsId) {
                const approach =
                    target.kind === TargetKind.Approach ? target.position.approach : undefined
                this.editSetup((deployment) => withCorpsStance(deployment, corpsId, approach))
                return
            }
            const unitId = this.setupUnitId
            assertExists(unitId, 'Detachment targets are offered for a unit picked in the roster')
            this.editSetup((deployment) =>
                withUnitSentTo(this.gameState.map, deployment, unitId, target.position)
            )
            return
        }
        if (target.kind === TargetKind.Retreat) {
            const stage = this.battleStage
            assert(
                stage?.kind === StageKind.Retreat,
                'Retreat targets are offered only while a retreat is arranged'
            )
            this.stageBattle(sendRetreatTo(stage, this.battle, target.position.locale))
            return
        }
        const order = this.order
        assertExists(order, 'Move targets are offered for an order')
        if (target.kind === TargetKind.Attack) {
            await this.threaten(target.position.approach, order)
            return
        }
        this.stageCommand(noCommandSelection())
        await this.applyAction(
            this.createPlayerAction(Move, {
                order: { ...order, road: target.road, entryId: target.entryId },
                to: target.position
            })
        )
    }

    async tapThreatArrow(target: AttackTarget, at: Point) {
        const sprite = this.selectedSprite
        const under = sprite ? topmostAt(sprite.blocks, at) : undefined
        if (sprite && under && this.mayChooseUnit(under.unit)) {
            this.tapBlock(sprite.group, under.unit.id)
        } else {
            await this.chooseTarget(target)
        }
    }

    async attach(commanderId: string, unitId: string) {
        if (!this.validActionTypes.includes(ActionType.Attach)) {
            return
        }
        this.stageCommand(noCommandSelection())
        await this.applyAction(this.createPlayerAction(Attach, { commanderId, unitId }))
    }

    async endTurn() {
        if (!this.validActionTypes.includes(ActionType.EndTurn)) {
            return
        }
        this.stageCommand(noCommandSelection())
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
        if (unitId) {
            this.editSetup((deployment) => withUnitAssigned(deployment, unitId, commanderId))
        }
    }

    recallDetachment(unitId: string) {
        this.editSetup((deployment) => withDetachmentRecalled(deployment, unitId))
    }

    toggleCorpsOffMap(commanderId: string) {
        this.editSetup((deployment) => withCorpsOffMapToggled(deployment, commanderId))
    }

    nameFixedBattery(unitId: string) {
        this.editSetup((deployment) => withBatteryNamed(this.gameState, deployment, unitId))
    }

    mayNameFixedBattery(unitId: string): boolean {
        const deployment = this.deployment
        return deployment !== undefined && mayNameFixedBattery(this.gameState, deployment, unitId)
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
            this.stageBattle({ defence: chooseRetreat(this.battle.defence) })
        }
    }

    cycleRetreatLoss(unitId: string) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat) {
            this.stageBattle(cycleLoss(this.gameState, stage, this.battle, unitId))
        }
    }

    keepInCorps(commanderId: string, unitId: string) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat) {
            this.stageBattle(keepWithCommander(stage, this.battle, commanderId, unitId))
        }
    }

    chooseAttackCommand(kind: CommandKind) {
        const stage = this.battleStage
        const choosing = stage && 'commandOptions' in stage && stage.commandOptions.includes(kind)
        if (choosing && stage.command !== kind) {
            this.stageBattle({ attackers: setAttackCommand(this.battle.attackers, kind) })
        }
    }

    chooseAttackWidth(width: AttackWidth) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Declaration && stage.wide !== (width === AttackWidth.Wide)) {
            this.stageBattle({ attackers: setAttackWidth(this.battle.attackers, width) })
        }
    }

    toggleCommanderStays(commanderId: string) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Advance) {
            this.stageBattle(toggleStaying(stage, this.battle, commanderId))
        }
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

    callFeint() {
        if (this.battleStage?.kind === StageKind.Feint && !this.battleStage.feinting) {
            this.stageBattle({ attackers: chooseFeint(this.battle.attackers) })
        }
    }

    async pressAttack() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Feint && stage.canPress && !stage.feinting) {
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
            await this.applyAction(
                this.createPlayerAction(Regroup, { keep: keptByCommander(stage) })
            )
        }
    }

    async advance() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Advance && stage.advancing.length > 0) {
            await this.applyAction(
                this.createPlayerAction(Advance, {
                    unitIds: stage.advancing,
                    commanderIds: commandersGoing(stage)
                })
            )
        }
    }

    async openHistoryLine(line: HistoryLine, time: string) {
        const replay = moveReplayOf(this.history.visibleContext, line.actionId, {
            time,
            text: line.text
        })
        if (replay) {
            this.openedReplay = replay
        } else {
            await this.history.goToActionIndex(line.index)
        }
    }

    closeMoveReplay() {
        this.openedReplay = undefined
    }

    setDarkBorders(darkBorders: boolean) {
        this.preferences.set({ darkBorders })
    }

    async visitMoveReplay() {
        const replay = this.moveReplay
        this.openedReplay = undefined
        if (replay) {
            await this.history.goToActionIndex(replay.index)
        }
    }

    hasManualSelection(): boolean {
        if (this.isDeploying) {
            return hasManualSetupSelection(this.setup)
        }
        if (this.battleStage) {
            return hasManualBattleSelection(this.battle, this.battleStage.kind)
        }
        return this.isCommanding && hasManualCommandSelection(this.selection)
    }

    override async undo() {
        if (!this.hasManualSelection()) {
            await super.undo()
        } else if (this.isDeploying) {
            this.setup = undoSetupSelection(this.setup)
        } else if (this.battleStage) {
            this.battle = undoBattleSelection(this.battle, this.battleStage.kind)
        } else {
            this.selection = undoCommandSelection(this.selection)
        }
    }

    resetAction() {
        this.selection = noCommandSelection()
        this.setup = noSetupSelection()
        this.battle = emptyBattleSelections()
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    private hasCommanded(group: PieceGroup): boolean {
        return (
            this.isCommanding &&
            group.playerId === this.myPlayerId &&
            group.commander?.commandsThisTurn !== undefined
        )
    }

    private startingUnits(group: PieceGroup): string[] {
        return unitsPickedUpWith(
            pickedUpOf(this.selection),
            group.units.filter((unit) => canStillMove(this.gameState, unit)).map((unit) => unit.id),
            group.commander !== undefined
        )
    }

    private async threaten(approach: number, order: MoveOrder) {
        if (!this.validActionTypes.includes(ActionType.ThreatenAttack)) {
            return
        }
        const guardUnitId = this.guardAttack ? this.guardUnitId : undefined
        const plan = { kind: order.kind, unitIds: [...order.unitIds] }
        this.stageCommand(noCommandSelection())
        await this.applyAction(
            this.createPlayerAction(
                ThreatenAttack,
                guardUnitId ? { approach, guardUnitId, plan } : { approach, plan }
            )
        )
    }

    private editSetup(change: (deployment: Deployment) => Deployment) {
        const deployment = this.deployment
        const side = this.mySide
        if (deployment && side) {
            const edited = settleFixedBattery(
                this.gameState,
                side,
                change(structuredClone($state.snapshot(deployment)))
            )
            this.stageSetup(recordSetupEdit(this.setup, edited))
        }
    }

    // The shared session ignores actions while it settles one and then resets these selections, so nothing is staged meanwhile.
    private announcePickUp() {
        if (this.selectedGroup) {
            for (const listener of this.pickUpListeners) {
                listener()
            }
        }
    }

    private stageCommand(selection: CommandSelection) {
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
