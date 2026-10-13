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
    standingGroupKey,
    validateAttach,
    type CommandKind,
    type Commander,
    type Face,
    type FeintEnd,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type NapoleonsTriumphPreferences,
    type NapoleonsTriumphProjectedState,
    type Position,
    type ProjectedUnit,
    type Side
} from '@tabletop/napoleons-triumph'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { shadeOf, type ArmyColors } from '$lib/utils/armyColors.js'
import { BoardView, viewRotation } from '$lib/utils/boardView.js'
import { commandDiscs } from '$lib/utils/commandTrack.js'
import { sameIds } from '$lib/utils/ids.js'
import { moraleMarkers, type MoraleMarker } from '$lib/utils/moraleTrack.js'
import { timeMarker } from '$lib/utils/timeTrack.js'
import {
    arrowsToKeepClear,
    flagMarks,
    flagScale,
    type FlagBearer,
    type FlagMark,
    type FlagView,
    type PlantedFlag
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
    setAttackRide,
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
    sendCommander,
    sendRetreatTo,
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
    addWayStep,
    chooseDetachedUnit,
    chosenCommandOf,
    chosenUnitsOf,
    destinationOf,
    guardAttackAnnounced,
    hasManualCommandSelection,
    noCommandSelection,
    pickedUpOf,
    rideOf,
    setCommand,
    setDestination,
    setRide,
    setGuardAttack,
    setPickedUp,
    undoCommandSelection,
    unitsPickedUpWith,
    wayStepsOf,
    type CommandSelection
} from './commandSelection.js'
import {
    arrayedArmy,
    deploymentOf,
    emptySetup,
    fits,
    seatedInACorps,
    withCorpsOnMap,
    withUnitReturned,
    type ArmySetup
} from './armySetup.js'
import { guardUnitToAnnounce, targetsOfGuardAttack } from './guardAttack.js'
import type { HistoryLine } from './historyChapters.js'
import {
    RideChoice,
    mayFireTogether,
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
    DestinationKind,
    hasManualSetupSelection,
    latestArrangement,
    noSetupSelection,
    recordArrangement,
    sameDestination,
    undoSetupSelection,
    type SetupDestination,
    type SetupFocus,
    type SetupSelection,
    type SetupStep
} from './setupSelection.js'
import {
    firstDestination,
    placedStraightFromPool,
    seatOfUnitApart,
    setupLocales,
    setupTable,
    setupTargets,
    unitsOfOpenSeat,
    withTargetChosen,
    type PoolStack,
    type SetupLocale,
    type SetupTable
} from './setupTable.js'
import {
    TargetKind,
    moveTargets,
    placeReachedSeveralWays,
    retreatTargets,
    threatenedApproaches,
    wayTargets,
    type AttackTarget,
    type MarchTarget,
    type MoveTarget,
    type WayTarget
} from './targets.js'
import { traceWays, type Way, type WayChoice, type WayStep } from './ways.js'

type ZoomSource = () => number | undefined

const ZOOM_BEFORE_THE_TABLE_IS_DRAWN = 0.3

export class NapoleonsTriumphGameSession extends GameSession<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> {
    private selection: CommandSelection = $state(noCommandSelection())
    private setup: SetupSelection = $state.raw(noSetupSelection())
    private setupFocus: SetupFocus | undefined = $state.raw()
    private battle: BattleSelections = $state(emptyBattleSelections())
    private readonly pickUpListeners = new Set<() => void>()
    private readonly seatOpenedListeners = new Set<() => void>()

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

    private setupStep: SetupStep | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.isDeploying || !playerId) {
            return undefined
        }
        const untouched = emptySetup(this.gameState, playerId)
        const setup = latestArrangement(this.setup) ?? untouched
        const { open, heldUnitId } = this.setupFocus ?? { open: firstDestination(untouched) }
        const stillInHand = heldUnitId !== undefined && !seatedInACorps(setup, heldUnitId)
        return { setup, open, heldUnitId: stillInHand ? heldUnitId : undefined }
    })

    setupTable: SetupTable | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        const step = this.setupStep
        return step && playerId ? setupTable(this.gameState, playerId, step) : undefined
    })

    setupLocales: SetupLocale[] = $derived(
        this.setupStep ? setupLocales(this.gameState, this.setupStep) : []
    )

    private arrayedArmy: HydratedNapoleonsTriumphGameState | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        const step = this.setupStep
        return step && playerId ? arrayedArmy(this.gameState, playerId, step.setup) : undefined
    })

    battleLocales: number[] = $derived(battleLocalesOf(this.gameState))

    closedReserves: number[] = $derived(this.gameState.limits.marchedLocales)

    settingUp = $derived(this.gameState.rounds.series.length === 0)

    spreadLocale: number | undefined = $state()

    wayUnderPointer: string | undefined = $state()

    private pickedUpLocale: number | undefined = $derived.by(() => {
        const groupKey = pickedUpOf(this.selection)?.groupKey
        return this.gameState.units.find(
            (unit) => groupKey !== undefined && standingGroupKey(unit) === groupKey
        )?.position?.locale
    })

    sprites: GroupSprite[] = $derived(
        layoutPieces(this.arrayedArmy ?? this.gameState, {
            rotation: this.boardRotation,
            looseLocales: [
                ...this.battleLocales,
                ...[this.spreadLocale, this.pickedUpLocale].filter((locale) => locale !== undefined)
            ]
        })
    )

    commandDiscs: Point[] = $derived(commandDiscs(this.gameState))

    timeMarker: Point = $derived(timeMarker(this.gameState))

    moraleMarkers: MoraleMarker[] = $derived(moraleMarkers(this.gameState))

    heldApproaches: HeldApproach[] = $derived(heldApproaches(this.sprites))

    flagView: FlagView = $derived({ rotation: this.boardRotation, scale: flagScale(this.zoom) })

    private plantedFlags: PlantedFlag[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId
            ? this.setupLocales
                  .filter((entry) => entry.empty)
                  .map(({ commanderId, locale }) => ({
                      commanderId,
                      at: LOCALE_GEOMETRY[locale].anchor,
                      colors: this.armyColors(playerId)
                  }))
            : []
    })

    flags: FlagMark[] = $derived.by(() => {
        const arrowApproaches = [
            ...(this.attack ? [this.attack.attackApproach] : []),
            ...threatenedApproaches(this.targets)
        ]
        return flagMarks(
            this.sprites,
            this.flagView,
            arrowsToKeepClear(arrowApproaches, this.zoom),
            (group) => this.flagBearer(group, this.hasCommanded(group)),
            this.plantedFlags
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

    private riderIds: string[] = $derived(this.openRoadMarch?.unitIds ?? [])

    private marchGroupKey: string | undefined = $derived(
        this.sprites.find((sprite) =>
            sprite.group.units.some((unit) => this.riderIds.includes(unit.id))
        )?.group.key
    )

    selectedGroupKey = $derived(
        this.isCommanding ? (pickedUpOf(this.selection)?.groupKey ?? this.marchGroupKey) : undefined
    )

    reinforcements: Reinforcement[] = $derived(
        this.mySide && this.isCommanding ? reinforcementsOf(this.gameState, this.mySide) : []
    )

    selectedSprite: GroupSprite | undefined = $derived(
        this.sprites.find((sprite) => sprite.group.key === this.selectedGroupKey)
    )

    ringedSprites: GroupSprite[] = $derived.by(() => {
        const step = this.setupStep
        if (!step) {
            return this.selectedSprite ? [this.selectedSprite] : []
        }
        const ofOpenSeat = unitsOfOpenSeat(step)
        return this.sprites.filter(({ group }) =>
            group.units.some((unit) => ofOpenSeat.includes(unit.id))
        )
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
        const chosen = chosenUnitsOf(this.selection)
        return chosen
            ? chosen.filter((id) => group.units.some((unit) => unit.id === id))
            : this.startingUnits(group)
    })

    private ridersInHand = $derived(
        this.riderIds.length > 0 && sameIds(this.pickedUnitIds, this.riderIds)
    )

    private corpsTakenWhole = $derived(
        this.selectedGroup?.commander !== undefined && chosenUnitsOf(this.selection) === undefined
    )

    private commandsForUnitsInHand: CommandKind[] = $derived.by(() => {
        const group = this.selectedGroup
        const playerId = this.myPlayerId
        const picked = this.pickedUnitIds
        const stillToMove = group?.units
            .filter((unit) => picked.includes(unit.id))
            .every((unit) => canStillMove(this.gameState, unit))
        return group && playerId && stillToMove
            ? moveCommandOptions(this.gameState, playerId, group, picked, this.corpsTakenWhole)
            : []
    })

    private ridersMayTakeNewCommand = $derived(
        this.ridersInHand && this.commandsForUnitsInHand.length > 0
    )

    ridingOn = $derived(
        this.ridersInHand &&
            !(this.ridersMayTakeNewCommand && rideOf(this.selection) === RideChoice.NewCommand)
    )

    rideChoice: RideChoice | undefined = $derived.by(() => {
        if (!this.ridersMayTakeNewCommand) {
            return undefined
        }
        return this.ridingOn ? RideChoice.RidingOn : RideChoice.NewCommand
    })

    wholeCorpsChosen = $derived(this.corpsTakenWhole && !this.ridingOn)

    commandOptions: CommandKind[] = $derived(this.ridingOn ? [] : this.commandsForUnitsInHand)

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

    destination: MarchTarget | undefined = $derived(
        placeReachedSeveralWays(this.orderTargets, destinationOf(this.selection))
    )

    private wayChoice: WayChoice | undefined = $derived(
        this.destination?.ways
            ? traceWays(this.destination.ways, wayStepsOf(this.selection))
            : undefined
    )

    stepsOfTheWay: WayStep[] = $derived(this.wayChoice?.next ?? [])

    private setupTargets: MoveTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        const step = this.setupStep
        return step && playerId ? setupTargets(this.gameState, playerId, step) : []
    })

    targets: MoveTarget[] = $derived.by(() => {
        const stage = this.battleStage
        if (this.isDeploying) {
            return this.setupTargets
        }
        if (stage?.kind === StageKind.Retreat) {
            return retreatTargets(stage.plan.room.keys())
        }
        if (this.wayChoice) {
            return wayTargets(this.stepsOfTheWay)
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
        riderIds: this.riderIds
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
        return own && (this.isDeploying || this.isCommanding)
    }

    maySpread(sprite: GroupSprite): boolean {
        const taken = this.canSelect(sprite.group)
        return !taken && (sprite.closedUp || sprite.group.position.locale === this.spreadLocale)
    }

    toggleSpread(sprite: GroupSprite) {
        if (!this.maySpread(sprite)) {
            return
        }
        const { locale } = sprite.group.position
        this.spreadLocale = this.spreadLocale === locale ? undefined : locale
    }

    selectGroup(group: PieceGroup) {
        if (!this.canSelect(group)) {
            return
        }
        if (this.isDeploying) {
            const [first] = group.units
            this.openOnMap(group, first.id)
            return
        }
        this.stageCommand(
            pickedUpOf(this.selection)?.groupKey === group.key
                ? noCommandSelection()
                : setPickedUp({ groupKey: group.key })
        )
        this.announcePickUp()
    }

    tapBlock(group: PieceGroup, unitId: string) {
        if (!this.canSelect(group)) {
            return
        }
        if (this.isDeploying) {
            this.openOnMap(group, unitId)
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
        return this.ridesAlone(unit) ? !this.ridingOn : canStillMove(this.gameState, unit)
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

    /** As with pieces picked up, the table is told when a set-up seat is opened, from the panel or by tapping a corps on the map. Taking a unit standing on its own in hand on the map is not announced: the view stays where the tap was. */
    onSeatOpened(listener: () => void): () => void {
        this.seatOpenedListeners.add(listener)
        return () => {
            this.seatOpenedListeners.delete(listener)
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
        if (this.ridesAlone(unit)) {
            this.stageCommand(noCommandSelection())
        } else if (group.commander) {
            this.stageCommand(chooseCorpsUnit(this.selection, unitId, this.commandableIds(group)))
        } else {
            const chosen = this.ridingOn ? [] : this.pickedUnitIds
            const playerId = this.myPlayerId
            const mayJoin =
                playerId !== undefined &&
                mayFireTogether(this.gameState, playerId, group, [...chosen, unitId])
            this.stageCommand(chooseDetachedUnit(this.selection, unitId, chosen, mayJoin))
        }
    }

    chooseRide(ride: RideChoice) {
        if (this.rideChoice !== undefined && ride !== this.rideChoice) {
            this.stageCommand(setRide(this.selection, ride))
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
        this.spreadLocale = undefined
        this.stageCommand(noCommandSelection())
    }

    async chooseTarget(target: MoveTarget) {
        if (this.busy || !this.targets.some((offered) => offered.key === target.key)) {
            return
        }
        if (this.isDeploying) {
            assert(
                target.kind === TargetKind.Reserve || target.kind === TargetKind.Approach,
                'Set-up offers positions only'
            )
            const step = this.setupStep
            assertExists(step, 'A place is chosen for a set-up in hand')
            this.arrange(withTargetChosen(step, target), step.heldUnitId)
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
        if (target.kind === TargetKind.Way) {
            await this.takeStepOfTheWay(target)
            return
        }
        const order = this.order
        assertExists(order, 'Move targets are offered for an order')
        if (target.kind === TargetKind.Attack) {
            await this.threaten(target.position.approach, order)
            return
        }
        const [way, ...otherWays] = target.ways ?? []
        if (otherWays.length > 0) {
            this.stageCommand(setDestination(this.selection, target.key))
            return
        }
        await this.move(order, target.position, way)
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

    openSetupDestination(open: SetupDestination) {
        const step = this.setupStep
        if (step && !sameDestination(step.open, open)) {
            this.stageSetup(this.setup, { open })
            for (const listener of this.seatOpenedListeners) {
                listener()
            }
        }
    }

    takeFromPool(stack: PoolStack) {
        const step = this.setupStep
        const unitId = stack.nextUnitId
        if (!step || !stack.offered || unitId === undefined) {
            return
        }
        const placed = placedStraightFromPool(step, unitId)
        if (placed) {
            this.arrange(placed)
        } else {
            this.stageSetup(this.setup, {
                open: step.open,
                heldUnitId: stack.held ? undefined : unitId
            })
        }
    }

    returnToPool(unitId: string) {
        const step = this.setupStep
        if (step) {
            this.arrange(withUnitReturned(step.setup, unitId))
        }
    }

    startCorpsOnMap(commanderId: string, onMap: boolean) {
        const step = this.setupStep
        if (step) {
            this.arrange(withCorpsOnMap(step.setup, commanderId, onMap))
        }
    }

    async commitSetup() {
        const playerId = this.myPlayerId
        const step = this.setupStep
        if (
            step &&
            playerId &&
            this.setupTable?.unassigned === 0 &&
            this.setupTable.problem === undefined &&
            this.validActionTypes.includes(ActionType.DeployArmy)
        ) {
            await this.applyAction(
                this.createPlayerAction(DeployArmy, {
                    deployment: deploymentOf(this.gameState, playerId, step.setup)
                })
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

    chooseAttackRide(ride: RideChoice) {
        const stage = this.battleStage
        const choosing = stage && 'ride' in stage && stage.ride !== undefined
        if (choosing && stage.ride !== ride) {
            this.stageBattle({ attackers: setAttackRide(this.battle.attackers, ride) })
        }
    }

    chooseAttackWidth(width: AttackWidth) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Declaration && stage.wide !== (width === AttackWidth.Wide)) {
            this.stageBattle({ attackers: setAttackWidth(this.battle.attackers, width) })
        }
    }

    sendCommanderForward(commanderId: string, goes: boolean) {
        const stage = this.battleStage
        if (
            stage?.kind === StageKind.Advance &&
            stage.commanders.some(
                (entry) => entry.commanderId === commanderId && entry.goes !== goes
            )
        ) {
            this.stageBattle(sendCommander(stage, this.battle, commanderId, goes))
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
        this.spreadLocale = undefined
        this.wayUnderPointer = undefined
        this.selection = noCommandSelection()
        this.setup = noSetupSelection()
        this.setupFocus = undefined
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

    private commandableIds(group: PieceGroup): string[] {
        return group.units
            .filter((unit) => canStillMove(this.gameState, unit))
            .map((unit) => unit.id)
    }

    private ridesAlone(unit: ProjectedUnit): boolean {
        return this.riderIds.includes(unit.id) && unit.commanderId === undefined
    }

    private startingUnits(group: PieceGroup): string[] {
        return unitsPickedUpWith(
            pickedUpOf(this.selection),
            this.commandableIds(group),
            group.commander !== undefined,
            group.key === this.marchGroupKey ? this.riderIds : []
        )
    }

    private async takeStepOfTheWay(step: WayTarget) {
        const destination = this.destination
        const order = this.order
        assertExists(destination?.ways, 'A step of the way is offered for a place already chosen')
        assertExists(order, 'A way is chosen for an order')
        const selection = addWayStep(this.selection, step.key)
        const { settled } = traceWays(destination.ways, wayStepsOf(selection))
        if (settled) {
            await this.move(order, destination.position, settled)
        } else {
            this.stageCommand(selection)
        }
    }

    private async move(order: MoveOrder, to: Position, way?: Way) {
        this.stageCommand(noCommandSelection())
        await this.applyAction(
            this.createPlayerAction(Move, {
                order: { ...order, road: way?.road, entryId: way?.entryId },
                to
            })
        )
    }

    private async threaten(approach: number, order: MoveOrder) {
        if (!this.validActionTypes.includes(ActionType.ThreatenAttack)) {
            return
        }
        const guardUnitId = this.guardAttack ? this.guardUnitId : undefined
        const plan = { kind: order.kind, unitIds: [...order.unitIds], continues: order.continues }
        this.stageCommand(noCommandSelection())
        await this.applyAction(
            this.createPlayerAction(
                ThreatenAttack,
                guardUnitId ? { approach, guardUnitId, plan } : { approach, plan }
            )
        )
    }

    private openOnMap(group: PieceGroup, unitId: string) {
        const step = this.setupStep
        if (!step) {
            return
        }
        if (group.commander) {
            this.openSetupDestination({
                kind: DestinationKind.Corps,
                commanderId: group.commander.id
            })
        } else if (step.heldUnitId !== unitId) {
            this.stageSetup(this.setup, {
                open: seatOfUnitApart(step.setup, unitId),
                heldUnitId: unitId
            })
        }
    }

    private arrange(setup: ArmySetup, heldUnitId?: string) {
        const playerId = this.myPlayerId
        const step = this.setupStep
        if (step && playerId) {
            assert(
                fits(this.gameState, playerId, setup),
                'Only arrangements within the maximums are offered in set-up'
            )
            this.stageSetup(recordArrangement(this.setup, setup), { open: step.open, heldUnitId })
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

    private stageSetup(setup: SetupSelection, focus: SetupFocus) {
        if (!this.busy) {
            this.setup = setup
            this.setupFocus = focus
        }
    }

    private stageBattle(selections: Partial<BattleSelections>) {
        if (!this.busy) {
            this.battle = { ...this.battle, ...selections }
        }
    }
}
