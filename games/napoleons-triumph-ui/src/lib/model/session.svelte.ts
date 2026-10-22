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
    LeadDefense,
    DeclareFeint,
    DeployArmy,
    isDeployArmy,
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
    objectiveHolds,
    type StarHold,
    standingGroupKey,
    validateAttach,
    type CommandKind,
    type Commander,
    type EndedAttack,
    type Face,
    type FeintEnd,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type NapoleonsTriumphPreferences,
    type NapoleonsTriumphProjectedState,
    type Position,
    type ProjectedUnit,
    Side
} from '@tabletop/napoleons-triumph'
import { inwardsFromTheEdge } from '$lib/map/battlefield.js'
import {
    CAPACITY_BOXES,
    ENTRY_GEOMETRY,
    LOCALE_GEOMETRY,
    PRINTED_STARS
} from '$lib/map/boardGeometry.js'
import { shadeOf, type ArmyColors } from '$lib/utils/armyColors.js'
import { BoardView, viewRotation } from '$lib/utils/boardView.js'
import { commandDiscs } from '$lib/utils/commandTrack.js'
import { describeAction } from '$lib/utils/describeAction.js'
import { sameIds } from '$lib/utils/ids.js'
import { moraleMarkers, type MoraleMarker } from '$lib/utils/moraleTrack.js'
import { timeMarker } from '$lib/utils/timeTrack.js'
import { inReadingOrder } from '$lib/utils/unitTypeOrder.js'
import { numberOfTrail, trailNumberOutline } from '$lib/utils/trailNumber.js'
import { drawnArrowOutlines, lineSamples } from '$lib/utils/wayArrow.js'
import {
    WAY_SIGN_REACH,
    waySignArrow,
    waySignOutline,
    type WaySignArrow
} from '$lib/utils/waySign.js'
import { retreatArrowOutlines, retreatArrows, type RetreatArrow } from '$lib/utils/retreatArrows.js'
import {
    arrowsToKeepClear,
    flagMarks,
    flagOutlines,
    flagScale,
    type FlagBearer,
    type FlagMark,
    type FlagView,
    type PlantedFlag
} from '$lib/utils/flagLayout.js'
import { blockOutline, topmostAt } from '$lib/utils/blockShape.js'
import {
    approachPlates,
    plateOutlines,
    plateSamples,
    type ApproachPlate
} from '$lib/utils/approachPlates.js'
import { capacityTags, type CapacityTag } from '$lib/utils/capacityTags.js'
import { printedStarSquare, starTags, type StarTag } from '$lib/utils/starTags.js'
import { gunTags, type GunTag } from '$lib/utils/gunTags.js'
import {
    SYMBOL_TAGS,
    approachSymbolScale,
    placeSymbolTags,
    printedMarksCovered,
    type PlacedSymbolTag
} from '$lib/utils/approachSymbols.js'
import { THREAT_ARROW, arrowOutlines, attackMarkerScale } from '$lib/utils/attackMarker.js'
import type { ConvexOutline } from '$lib/utils/convexOutline.js'
import { boxSamples, cornersOf } from '$lib/utils/orientedBox.js'
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
    takeRetreatLosses,
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
    committedUnits,
    foldsAway,
    knownToTheEnemy,
    liftRetreatingCommander,
    keptByCommander,
    moveLossOnto,
    pickUnit,
    committedRoles,
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
    type BlockMarkContext,
    type UnitLook
} from './blockMark.js'
import {
    chooseCorpsUnit,
    addWayStep,
    aimOf,
    chooseDetachedUnit,
    chosenCommandOf,
    chosenUnitsOf,
    destinationOf,
    hasManualCommandSelection,
    noCommandSelection,
    pickedUpOf,
    rideOf,
    attachChosenOf,
    setAttach,
    setCommand,
    setDestination,
    setRide,
    setAim,
    setPickedUp,
    guardUnitOf,
    setGuardUnit,
    setThreat,
    threatOf,
    withoutGuardUnit,
    undoCommandSelection,
    unitsPickedUpWith,
    wayStepsOf,
    type CommandSelection
} from './commandSelection.js'
import {
    arrayedArmy,
    deploymentOf,
    emptySetup,
    setupOfDeployment,
    fits,
    seatedInACorps,
    withCorpsOnMap,
    withUnitReturned,
    type ArmySetup
} from './armySetup.js'
import { guardUnitsToAnnounce } from './guardAttack.js'
import { historyChapters, type HistoryChapter, type HistoryLine } from './historyChapters.js'
import { lossesOfAttack, type AttackLosses } from './attackLosses.js'
import { arrowDrawingOf, attackMarkOf, type AttackMark } from './attackMark.js'
import { fightOf, recordedAccounts, verdictOf, type ResultAccounts } from './resultAccount.js'
import { turnTrails, type Trail } from './turnTrails.js'
import {
    RideChoice,
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
    attackableLocales,
    moveTargets,
    placeReachedSeveralWays,
    retreatTargets,
    threatenedApproaches,
    threatsOn,
    wayTargets,
    type AttackTarget,
    type MarchTarget,
    type MoveTarget,
    type WaySign,
    type WayTarget
} from './targets.js'
import { WayStepKind, traceWays, type Way, type WayChoice, type WayStep } from './ways.js'
import { concludedBattleOf, type ConcludedBattle } from './concludedBattle.js'

type ZoomSource = () => number | undefined

const ZOOM_BEFORE_THE_TABLE_IS_DRAWN = 0.3

export class NapoleonsTriumphGameSession extends GameSession<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> {
    private selection: CommandSelection = $state(noCommandSelection())
    private setup: SetupSelection = $state.raw(noSetupSelection())
    private setupFocus: SetupFocus | undefined = $state.raw()
    // Deliberate: a player deploys once, so being asked to again means the Deploy was taken back,
    // and the set-up starts from the army as that Deploy had it. Kept by player for a shared screen.
    private setupsTakenBack: Record<string, ArmySetup> = $state.raw({})
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

    movementTrailsShown = $derived(this.preferences.values.movementTrails)

    capacitiesShown = $derived(this.preferences.values.localeCapacities)

    pictureShowsUnitTypes = $state(true)

    private facesCoveredForPicture = $state(false)

    boardRotation = $derived(viewRotation(this.boardView))

    attack = $derived(this.gameState.attack)

    concludedBattle: ConcludedBattle | undefined = $derived(
        this.isViewingHistory ? undefined : concludedBattleOf(this.history.visibleContext)
    )

    private concludedBattleSetAside = $state(false)

    setConcludedBattleAside() {
        this.concludedBattleSetAside = true
    }

    shownAttack: EndedAttack | undefined = $derived(this.attack ?? this.concludedBattle?.attack)

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
        const setup = latestArrangement(this.setup) ?? this.setupsTakenBack[playerId] ?? untouched
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

    private aimedThreats: AttackTarget[] = $derived.by(() => {
        const locale = aimOf(this.selection)
        const playerId = this.myPlayerId
        if (!this.isCommanding || locale === undefined || !playerId) {
            return []
        }
        return threatsOn(this.gameState, playerId, locale)
    })

    aimableLocales: number[] = $derived(
        this.isCommanding && this.myPlayerId
            ? attackableLocales(this.gameState, this.myPlayerId)
            : []
    )

    aimedLocale: number | undefined = $derived(
        this.aimedThreats.length > 0 ? aimOf(this.selection) : undefined
    )

    private threatLocale: number | undefined = $derived.by(() => {
        const approach = threatOf(this.selection)
        return approach === undefined ? undefined : this.gameState.map.approach(approach).locale
    })

    private pickedUpLocale: number | undefined = $derived.by(() => {
        const groupKey = pickedUpOf(this.selection)?.groupKey
        return this.gameState.units.find(
            (unit) => groupKey !== undefined && standingGroupKey(unit) === groupKey
        )?.position?.locale
    })

    sprites: GroupSprite[] = $derived(
        layoutPieces(this.arrayedArmy ?? this.gameState, {
            rotation: this.boardRotation,
            readBy: this.myPlayerId,
            singledOut: [...committedUnits(this.attack), ...knownToTheEnemy(this.gameState.units)],
            looseLocales: [
                ...this.battleLocales,
                ...[
                    this.spreadLocale,
                    this.pickedUpLocale,
                    this.aimedLocale,
                    this.threatLocale
                ].filter((locale) => locale !== undefined)
            ]
        })
    )

    movementTrails: Trail[] = $derived(
        this.movementTrailsShown
            ? turnTrails(
                  this.history.visibleContext,
                  this.sprites.flatMap((sprite) => sprite.blocks),
                  { rotation: this.boardRotation, readBy: this.myPlayerId }
              )
            : []
    )

    commandDiscs: Point[] = $derived(commandDiscs(this.gameState))

    timeMarker: Point = $derived(timeMarker(this.gameState))

    moraleMarkers: MoraleMarker[] = $derived(moraleMarkers(this.gameState))

    heldApproaches: HeldApproach[] = $derived(heldApproaches(this.sprites))

    approachPlates: ApproachPlate[] = $derived(approachPlates(this.heldApproaches))

    approachSymbolTags: PlacedSymbolTag[] = $derived.by(() => {
        const onPlates = this.approachPlates.map((plate) => plate.side)
        const arrows = this.arrowOutlines
        const shown = SYMBOL_TAGS.filter(
            (tag) =>
                !onPlates.includes(tag.key) &&
                (this.approachSymbolsShown || printedMarksCovered(tag, arrows))
        )
        return placeSymbolTags(shown, approachSymbolScale(this.zoom), arrows)
    })

    private threatArrowApproaches: number[] = $derived.by(() => [
        ...threatenedApproaches(this.targets),
        ...(this.threatBeingDeclared ? [this.threatBeingDeclared.position.approach] : [])
    ])

    private arrowOutlines: ConvexOutline[] = $derived.by(() => {
        const scale = attackMarkerScale(this.zoom)
        const mark = this.attackMark
        return [
            ...(mark ? arrowOutlines(mark.approach, scale, arrowDrawingOf(mark)) : []),
            ...this.threatArrowApproaches.flatMap((approach) =>
                arrowOutlines(approach, scale, THREAT_ARROW)
            )
        ]
    })

    gunTags: GunTag[] = $derived(gunTags(this.gameState, this.boardRotation, this.arrowOutlines))

    // A number, not the view object, so what is sized by it is worked out again only when the scale changes.
    private flagSize: number = $derived(flagScale(this.zoom))

    flagView: FlagView = $derived({ rotation: this.boardRotation, scale: this.flagSize })

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
            ...this.threatArrowApproaches
        ]
        return flagMarks(
            this.sprites,
            this.flagView,
            [
                ...arrowsToKeepClear(arrowApproaches, this.zoom),
                ...plateSamples(this.approachPlates),
                ...this.gunTags.flatMap((tag) => boxSamples(tag.box)),
                ...this.approachSymbolTags.flatMap((tag) =>
                    tag.slid ? boxSamples(tag.cover) : []
                ),
                ...this.movementTrails.flatMap((trail) => [
                    ...lineSamples(trail.line),
                    numberOfTrail(trail, this.flagView.scale).at
                ])
            ],
            (group) => this.flagBearer(group, this.hasCommanded(group)),
            this.plantedFlags,
            [
                ...Object.values(CAPACITY_BOXES).map((box) => [box]),
                ...Object.values(PRINTED_STARS)
                    .flat()
                    .map((star) => boxSamples(printedStarSquare(star)))
            ]
        )
    })

    waySigns: WaySign[] = $derived.by(() => {
        const scale = this.flagSize
        return this.targets.flatMap((target) =>
            target.kind === TargetKind.Way ? [{ target, ...this.waySignOf(target, scale) }] : []
        )
    })

    private waySignOf({ step }: WayTarget, scale: number): { at: Point; arrow: WaySignArrow } {
        const anchorOf = (locale: number | undefined): Point | undefined =>
            locale === undefined ? undefined : LOCALE_GEOMETRY[locale].anchor
        if (step.kind === WayStepKind.Entry) {
            const entry = ENTRY_GEOMETRY[step.entryId].at
            const inwards = inwardsFromTheEdge(entry)
            const clear = WAY_SIGN_REACH * scale
            const at = { x: entry.x + inwards.x * clear, y: entry.y + inwards.y * clear }
            return { at, arrow: waySignArrow(at, entry, undefined) }
        }
        const at = LOCALE_GEOMETRY[step.locale].anchor
        const comesFrom = anchorOf(step.before) ?? this.selectedSprite?.centre
        return { at, arrow: waySignArrow(at, comesFrom, anchorOf(step.after)) }
    }

    retreatArrows: RetreatArrow[] = $derived.by(() => {
        const stage = this.battleStage
        const [, from] = this.battleLocales
        return stage?.kind === StageKind.Retreat && from !== undefined
            ? retreatArrows(from, stage.plan.destinations)
            : []
    })

    private drawnOverTheMap: ConvexOutline[] = $derived([
        ...this.sprites.flatMap((sprite) => sprite.blocks.map(blockOutline)),
        ...this.arrowOutlines,
        ...plateOutlines(this.approachPlates),
        ...this.gunTags.map((tag) => cornersOf(tag.box)),
        ...this.approachSymbolTags.map((tag) => cornersOf(tag.cover)),
        ...this.movementTrails.flatMap((trail) => [
            ...drawnArrowOutlines(trail.arrow),
            trailNumberOutline(numberOfTrail(trail, this.flagSize))
        ]),
        ...this.retreatArrows.flatMap(retreatArrowOutlines),
        ...this.waySigns.map(({ at }) => waySignOutline(at, this.flagSize)),
        ...this.flags.flatMap((flag) => flagOutlines(flag, this.flagView))
    ])

    // Placed after the flags and kept off them, so no flag hides a capacity; the flags keep off the printed boxes instead.
    capacityTags: CapacityTag[] = $derived.by(() => {
        const map = this.gameState.map
        return capacityTags((locale) => map.locale(locale).capacity, {
            allShown: this.capacitiesShown,
            scale: this.flagSize,
            obstacles: this.drawnOverTheMap
        })
    })

    starHolds: StarHold[] = $derived(
        this.gameState.players.flatMap((player) =>
            player.side
                ? objectiveHolds(this.gameState, player.playerId, (unit) => this.visibleFace(unit))
                : []
        )
    )

    starTags: StarTag[] = $derived.by(() => {
        const map = this.gameState.map
        return starTags((locale) => map.locale(locale).stars, this.starHolds, {
            scale: this.flagSize,
            obstacles: this.drawnOverTheMap,
            capacityTags: this.capacityTags.map((tag) => cornersOf(tag.cover))
        })
    })

    chapters: HistoryChapter[] = $derived(
        historyChapters(
            this.actions,
            this.gameState.rounds.series,
            this.gameState.scenario,
            (action) => describeAction(action, this.gameState)
        )
    )

    private picturedLines: { line: HistoryLine; time: string }[] = $derived(
        this.chapters.flatMap((chapter) =>
            chapter.entries
                .flatMap((entry) => [entry, ...entry.steps])
                .filter((line) => line.pictured)
                .map((line) => ({ line, time: chapter.title }))
        )
    )

    private openedReplay: MoveReplay | undefined = $state.raw()

    moveReplay: MoveReplay | undefined = $derived.by(() => {
        const opened = this.openedReplay
        const stillRecorded = this.actions.some((action) => action.id === opened?.actionId)
        return stillRecorded ? opened : undefined
    })

    earlierReplay: MoveReplay | undefined = $derived(this.replayBeside(-1))

    laterReplay: MoveReplay | undefined = $derived(this.replayBeside(1))

    moveReplayScene: MoveReplayScene | undefined = $derived(
        this.moveReplay
            ? moveReplayScene(this.moveReplay, this.boardRotation, this.myPlayerId)
            : undefined
    )

    battleStage: BattleStage | undefined = $derived.by(() => {
        const attack = this.attack
        return attack && this.canAct
            ? battleStageOf(this.gameState, attack, this.battle)
            : undefined
    })

    actionPanelFolded = $derived(this.preferences.values.actionPanelFolded)

    battlePanelFoldable: boolean = $derived(foldsAway(this.battleStage))

    battlePanelShownFolded: boolean = $derived(this.actionPanelFolded && this.battlePanelFoldable)

    battleRoles: Record<string, BattleRole> = $derived(rolesShown(this.attack, this.battleStage))
    /** The roles the units of the fight were named to, whatever is being picked in the step now open. */
    foughtRoles: Record<string, BattleRole> = $derived(
        this.shownAttack ? committedRoles(this.shownAttack) : {}
    )

    /** Which way the settled result of the attack in progress decides it, and why. */
    attackVerdict: string | undefined = $derived.by(() => {
        const attack = this.shownAttack
        if (!attack || attack.finalResult === undefined || attack.attackerWon === undefined) {
            return undefined
        }
        const attackerIsFrench = this.gameState.sideOf(attack.attackerId) === Side.French
        return verdictOf(attack.finalResult, fightOf(attack, attackerIsFrench))
    })

    attackLosses: AttackLosses | undefined = $derived(
        this.shownAttack
            ? lossesOfAttack(
                  this.history.visibleContext.actions,
                  this.shownAttack,
                  this.attack?.pending ?? []
              )
            : undefined
    )

    attackMark: AttackMark | undefined = $derived(
        this.attack ? attackMarkOf(this.attack) : undefined
    )

    /** What the results of the attack in progress are made of: as the pieces named so far would make them while a step is being decided, and as the game kept them once it is. */
    resultAccounts: ResultAccounts = $derived.by(() => {
        const stage = this.battleStage
        const recorded = recordedAccounts(this.history.visibleContext.actions)
        return {
            initial:
                stage?.kind === StageKind.Declaration ? stage.initialAccount : recorded.initial,
            counter: stage?.kind === StageKind.Counter ? stage.counterAccount : recorded.counter
        }
    })

    // Rule 11: cavalry that has taken a locale by road may ride on.
    private openRoadMarch = $derived(this.isCommanding ? this.gameState.roadMarch : undefined)

    private turnedToOrders = $derived(
        this.concludedBattleSetAside ||
            hasManualCommandSelection(this.selection) ||
            this.openRoadMarch !== undefined
    )

    showsConcludedBattle = $derived(
        this.concludedBattle !== undefined && !(this.isCommanding && this.turnedToOrders)
    )

    private riderIds: string[] = $derived(this.openRoadMarch?.unitIds ?? [])

    private marchGroupKey: string | undefined = $derived(
        this.sprites.find((sprite) =>
            sprite.group.units.some((unit) => this.riderIds.includes(unit.id))
        )?.group.key
    )

    selectedGroupKey = $derived(
        this.isCommanding && this.aimedLocale === undefined
            ? (pickedUpOf(this.selection)?.groupKey ?? this.marchGroupKey)
            : undefined
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

    private placesOnOffer: MoveTarget[] = $derived.by(() => {
        const stage = this.battleStage
        if (this.isDeploying) {
            return this.setupTargets
        }
        if (stage?.kind === StageKind.Retreat) {
            const sending = !stage.choosingLosses && stage.movingCommander === undefined
            return sending ? retreatTargets(stage.plan.room.keys()) : []
        }
        if (this.wayChoice) {
            return wayTargets(this.stepsOfTheWay)
        }
        return this.aimedLocale !== undefined ? this.aimedThreats : this.orderTargets
    })

    threatBeingDeclared: AttackTarget | undefined = $derived.by(() => {
        const approach = threatOf(this.selection)
        return this.placesOnOffer.find(
            (target): target is AttackTarget =>
                target.kind === TargetKind.Attack && target.position.approach === approach
        )
    })

    guardUnitsToShow: string[] = $derived(
        this.threatBeingDeclared && this.myPlayerId
            ? guardUnitsToAnnounce(this.gameState, this.myPlayerId, this.threatBeingDeclared)
            : []
    )

    guardUnitChosen: string | undefined = $derived.by(() => {
        const chosen = guardUnitOf(this.selection)
        return chosen !== undefined && this.guardUnitsToShow.includes(chosen) ? chosen : undefined
    })

    guardSprite: GroupSprite | undefined = $derived(
        this.sprites.find((sprite) =>
            sprite.group.units.some((unit) => unit.id === this.guardUnitChosen)
        )
    )

    /** Rule 9: Attach is chosen in the command switch; it moves nothing, so the board offers no move. */
    attachChosen = $derived(attachChosenOf(this.selection))

    targets: MoveTarget[] = $derived(
        this.threatBeingDeclared || this.attachChosen ? [] : this.placesOnOffer
    )

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

    /** Ids as the game holds the units, so the order they were tapped in, which may follow their strength, tells the enemy nothing. */
    private inGameOrder(unitIds: readonly string[]): string[] {
        return this.gameState.units.flatMap((unit) => (unitIds.includes(unit.id) ? [unit.id] : []))
    }

    private ordersInGameOrder(orders: readonly MoveOrder[]): MoveOrder[] {
        return orders.map((order) => ({ ...order, unitIds: this.inGameOrder(order.unitIds) }))
    }

    /** The viewer's own units are listed in reading order; anyone else's as the game holds them, so their order tells nothing. */
    asRead(playerId: string, units: readonly ProjectedUnit[]): ProjectedUnit[] {
        return playerId === this.myPlayerId ? inReadingOrder(units) : [...units]
    }

    /** A picture without unit types is taken of the board as it stands while this is on, and it is on for no longer than that. */
    coverFacesOnTheMap(covered: boolean) {
        this.facesCoveredForPicture = covered
    }

    /** The viewer's own unit standing face-up to the enemy, as it does until the end-of-turn shuffle hides it again (rule 7). */
    seenByTheEnemy(unit: ProjectedUnit): boolean {
        return unit.playerId === this.myPlayerId && unit.shown !== undefined
    }

    /** How a unit is drawn for the viewer. The fixed battery stands face-up all game, so its own mark says the enemy sees it. */
    lookOf(unit: ProjectedUnit): UnitLook {
        const fixed = unit.fixed === true
        return {
            face: this.visibleFace(unit),
            seen: !fixed && this.seenByTheEnemy(unit),
            fixed
        }
    }

    /** Neither face nor mark while faces are covered for a picture saved without unit types. */
    lookOnTheMap(unit: ProjectedUnit): UnitLook {
        return this.facesCoveredForPicture
            ? { face: undefined, seen: false, fixed: false }
            : this.lookOf(unit)
    }

    visibleFace(unit: ProjectedUnit): Face | undefined {
        return unit.playerId === this.myPlayerId ? (unit.face ?? unit.shown) : unit.shown
    }

    flagBearer(group: PieceGroup, hasCommanded: boolean): FlagBearer {
        return {
            colors: this.armyColors(group.playerId),
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
            this.stageCommand(chooseDetachedUnit(this.selection, unitId, chosen))
        }
    }

    chooseRide(ride: RideChoice) {
        if (this.rideChoice !== undefined && ride !== this.rideChoice) {
            this.stageCommand(setRide(this.selection, ride))
        }
    }

    chooseAttach() {
        if (!this.attachChosen) {
            this.stageCommand(setAttach(this.selection))
        }
    }

    chooseCommand(kind: CommandKind) {
        if (
            (this.attachChosen || kind !== this.commandKind) &&
            this.commandOptions.includes(kind)
        ) {
            this.stageCommand(setCommand(this.selection, kind))
        }
    }

    clearSelection() {
        this.spreadLocale = undefined
        this.stageCommand(noCommandSelection())
    }

    mayAimAt(locale: number): boolean {
        return !this.busy && this.aimableLocales.includes(locale)
    }

    aimTask(locale: number): string {
        const place = this.gameState.map.label(locale)
        return locale === this.aimedLocale ? `Stop aiming at ${place}` : `Aim an attack at ${place}`
    }

    aimAt(locale: number) {
        if (!this.mayAimAt(locale)) {
            return
        }
        this.stageCommand(locale === this.aimedLocale ? noCommandSelection() : setAim(locale))
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
        if (target.kind === TargetKind.Attack) {
            await this.chooseThreat(target)
            return
        }
        const order = this.order
        assertExists(order, 'Move targets are offered for an order')
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

    moveRetreatLossOnto(unitId: string) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat) {
            this.stageBattle(moveLossOnto(this.gameState, stage, this.battle, unitId))
        }
    }

    takeRetreatLosses() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat && stage.choosingLosses && stage.plan.lossesValid) {
            this.stageBattle(takeRetreatLosses(this.battle))
        }
    }

    liftRetreatingCommander(commanderId: string) {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat) {
            this.stageBattle(liftRetreatingCommander(stage, this.battle, commanderId))
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
                    unitIds: this.inGameOrder(stage.defenders)
                })
            )
        }
    }

    async leadDefense() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.DefenceLeaders && !stage.problem) {
            await this.applyAction(
                this.createPlayerAction(LeadDefense, { leaderIds: stage.leaders })
            )
        }
    }

    async commitRetreat() {
        const stage = this.battleStage
        if (stage?.kind === StageKind.Retreat && !stage.choosingLosses && stage.plan.lossesValid) {
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
                this.createPlayerAction(DeclareFeint, {
                    orders: this.ordersInGameOrder(stage.orders),
                    end
                })
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
                    orders: this.ordersInGameOrder(stage.orders),
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
                this.createPlayerAction(CounterAttack, {
                    unitIds: this.inGameOrder(stage.counterAttackers)
                })
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

    openHistoryLine(line: HistoryLine, time: string) {
        const replay = this.replayOfLine(line, time)
        if (replay) {
            this.openedReplay = replay
        }
    }

    stepMoveReplay(step: -1 | 1) {
        const beside = step < 0 ? this.earlierReplay : this.laterReplay
        if (beside) {
            this.openedReplay = beside
        }
    }

    private replayOfLine(line: HistoryLine, time: string): MoveReplay | undefined {
        return moveReplayOf(this.history.visibleContext, line.actionId, { time, text: line.text })
    }

    /** The nearest line of the history before or after the one opened that has a picture to show. */
    private replayBeside(step: -1 | 1): MoveReplay | undefined {
        const lines = this.picturedLines
        const opened = lines.findIndex(({ line }) => line.actionId === this.moveReplay?.actionId)
        if (opened < 0) {
            return undefined
        }
        for (let at = opened + step; at >= 0 && at < lines.length; at += step) {
            const replay = this.replayOfLine(lines[at].line, lines[at].time)
            if (replay) {
                return replay
            }
        }
        return undefined
    }

    closeMoveReplay() {
        this.openedReplay = undefined
    }

    setDarkBorders(darkBorders: boolean) {
        this.preferences.set({ darkBorders })
    }

    setMovementTrailsShown(movementTrails: boolean) {
        this.preferences.set({ movementTrails })
    }

    setCapacitiesShown(localeCapacities: boolean) {
        this.preferences.set({ localeCapacities })
    }

    setActionPanelFolded(actionPanelFolded: boolean) {
        this.preferences.set({ actionPanelFolded })
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
            this.keepSetupOfDeployToUndo()
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
        this.concludedBattleSetAside = false
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
            !this.isViewingHistory &&
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

    toggleGuardUnit(unitId: string) {
        assert(
            this.guardUnitsToShow.includes(unitId),
            'Only Guard units that could announce the attack are offered'
        )
        this.stageCommand(
            unitId === this.guardUnitChosen
                ? withoutGuardUnit(this.selection)
                : setGuardUnit(this.selection, unitId)
        )
    }

    async declareThreat() {
        const threat = this.threatBeingDeclared
        assertExists(threat, 'A threat is declared once its approach is chosen')
        await this.threaten(threat.position.approach, this.guardUnitChosen)
    }

    private async chooseThreat(target: AttackTarget) {
        const playerId = this.myPlayerId
        assertExists(playerId, 'Threats are offered to a player')
        if (guardUnitsToAnnounce(this.gameState, playerId, target).length > 0) {
            this.stageCommand(setThreat(this.selection, target.position.approach))
        } else {
            await this.threaten(target.position.approach)
        }
    }

    private async threaten(approach: number, guardUnitId?: string) {
        if (this.busy || !this.validActionTypes.includes(ActionType.ThreatenAttack)) {
            return
        }
        const order = this.order
        const plan = order
            ? { kind: order.kind, unitIds: [...order.unitIds], continues: order.continues }
            : undefined
        this.stageCommand(noCommandSelection())
        await this.applyAction(
            this.createPlayerAction(ThreatenAttack, {
                approach,
                ...(guardUnitId ? { guardUnitId } : {}),
                ...(plan ? { plan } : {})
            })
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

    private keepSetupOfDeployToUndo() {
        const action = this.undoableAction
        if (isDeployArmy(action)) {
            this.setupsTakenBack = {
                ...this.setupsTakenBack,
                [action.playerId]: setupOfDeployment(this.gameState.map, action.deployment)
            }
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
