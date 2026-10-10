import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    Advance,
    AssignLosses,
    Attach,
    CommandKind,
    CounterAttack,
    DeclareAttack,
    DeclareDefense,
    DeclareFeint,
    DeployArmy,
    EndTurn,
    FeintEnd,
    MAX_CORPS_UNITS,
    MachineState,
    Move,
    Occupy,
    PassBid,
    PlaceBid,
    ChooseSide,
    PressAttack,
    Regroup,
    Retreat,
    Side,
    ThreatenAttack,
    DETACHMENT_REACH,
    HydratedNapoleonsTriumphGameState,
    MAX_FRENCH_DETACHMENTS,
    SANTON_LOCALE,
    UnitType,
    canStillMove,
    commanderCanCommand,
    commandersOf,
    deployArmy,
    independentCommandsLeft,
    mayEnter,
    samePosition,
    suggestedDeployment,
    type Commander,
    type Deployment,
    type Position,
    type Face,
    AttackStep,
    type MoveOrder,
    type NapoleonsTriumphProjectedState,
    type ProjectedUnit,
    type RetreatPlan
} from '@tabletop/napoleons-triumph'
import { layoutPieces, type GroupSprite, type PieceGroup } from '$lib/utils/pieceLayout.js'
import { BoardView, viewRotation } from '$lib/utils/boardView.js'
import {
    clearCommandSelection,
    emptySelection,
    hasManualCommandSelection,
    popCommandSelection,
    setCommandSelection,
    type CommandSelection
} from './selection.js'
import { TargetKind, moveTargets, type MoveTarget } from './targets.js'
import { retreatDraft, type RetreatDraft } from './retreatDraft.js'
import {
    battleStage,
    committedRoles,
    emptyBattleDraft,
    type BattleDraft,
    type BattleStage
} from './battle.js'

/** A corps still off the map that may come on this turn. */
export interface Reinforcement {
    commander: Commander
    units: ProjectedUnit[]
}

export class NapoleonsTriumphGameSession extends GameSession<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> {
    private selection: CommandSelection = $state(emptySelection())

    /** The order the attacker had in hand when threatening, offered again when declaring. */
    plannedOrder: MoveOrder | undefined = $state()

    /** Board zoom as last reported by the board, for labels that keep a readable size. */
    zoom = $state(0.3)

    /** How the board is turned on screen. */
    boardView: BoardView = $state(BoardView.North)

    boardRotation = $derived(viewRotation(this.boardView))

    /** The player's picks for the attack step in front of them. */
    battleDraft: BattleDraft = $state(emptyBattleDraft())

    attack = $derived(this.gameState.attack)

    myPlayerId = $derived(this.myPlayer?.id)

    mySide: Side | undefined = $derived(
        this.myPlayerId ? this.gameState.findPlayerState(this.myPlayerId)?.side : undefined
    )

    canAct = $derived(this.isMyTurn && !this.isViewingHistory)

    isCommanding = $derived(
        this.canAct && this.gameState.machineState === MachineState.Commanding
    )

    isAuction = $derived(
        this.gameState.machineState === MachineState.Bidding ||
            this.gameState.machineState === MachineState.ChoosingSide
    )

    isSetup = $derived(
        this.gameState.machineState === MachineState.AlliedSetup ||
            this.gameState.machineState === MachineState.FrenchSetup
    )

    /** The set-up being arranged, before it is committed. */
    setupDraft: Deployment | undefined = $state()

    /** A unit picked in the set-up roster, waiting to be given to a corps or sent somewhere. */
    setupUnitId: string | undefined = $state()

    isDeploying = $derived(
        this.canAct && this.isSetup && this.validActionTypes.includes(ActionType.DeployArmy)
    )

    deployment: Deployment | undefined = $derived.by(() => {
        const side = this.mySide
        if (!this.isDeploying || !side) {
            return undefined
        }
        return this.setupDraft ?? suggestedDeployment(this.gameState, side)
    })

    /** The table as it would stand if the set-up were committed now, or why it cannot be. */
    setupPreview: { state?: HydratedNapoleonsTriumphGameState; problem?: string } = $derived.by(() => {
        const playerId = this.myPlayerId
        const deployment = this.deployment
        if (!deployment || !playerId) {
            return {}
        }
        const preview = new HydratedNapoleonsTriumphGameState(structuredClone(this.gameState.dehydrate()))
        try {
            deployArmy(preview, playerId, deployment)
            return { state: preview }
        } catch (error) {
            return { problem: error instanceof Error ? error.message : String(error) }
        }
    })

    /** The two locales an attack in progress is fought between. */
    battleLocales: number[] = $derived.by(() => {
        const attack = this.attack
        if (!attack) {
            return []
        }
        const map = this.gameState.map
        return [map.approach(attack.attackApproach).locale, map.approach(attack.defenseApproach).locale]
    })

    sprites: GroupSprite[] = $derived(
        layoutPieces(this.setupPreview.state ?? this.gameState, {
            rotation: this.boardRotation,
            looseLocales: this.battleLocales
        })
    )

    /** The picking on blocks the attack step in front of the player asks for. */
    battleStage: BattleStage | undefined = $derived.by(() => {
        const attack = this.attack
        return attack && this.canAct
            ? battleStage(this.gameState, attack, this.battleDraft, this.plannedOrder)
            : undefined
    })

    /** What each piece in the attack is doing, as named so far and as the player is now picking. */
    battleRoles: Record<string, string> = $derived.by(() => {
        if (this.retreatDraft) {
            const alone = this.battleDraft.retreatUnitId
            return alone ? { [alone]: 'retreats' } : {}
        }
        return {
            ...(this.attack ? committedRoles(this.attack) : {}),
            ...(this.battleStage?.roles ?? {})
        }
    })

    selectedGroupKey = $derived(this.isCommanding ? this.selection.group?.value : undefined)

    /** Corps of the acting army still off the map that may enter now. */
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
            .map((commander) => ({
                commander,
                units: this.gameState.corpsUnits(commander.id)
            }))
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
            position: { locale: -1 },
            commander: reinforcement.commander,
            units: reinforcement.units
        }
    })

    selectedGroup: PieceGroup | undefined = $derived(
        this.sprites.find((sprite) => sprite.group.key === this.selectedGroupKey)?.group ??
            this.selectedReinforcement
    )

    selectedSprite: GroupSprite | undefined = $derived(
        this.sprites.find((sprite) => sprite.group.key === this.selectedGroupKey)
    )

    /** Units of the selected group named in the order being built. */
    pickedUnitIds: string[] = $derived.by(() => {
        const group = this.selectedGroup
        if (!group) {
            return []
        }
        const picked = this.selection.units?.value ?? []
        return picked.filter((id) => group.units.some((unit) => unit.id === id))
    })

    /** Command kinds the picked units could be moved by, most natural first. */
    commandOptions: CommandKind[] = $derived.by(() => {
        const group = this.selectedGroup
        const playerId = this.myPlayerId
        if (!group || !playerId || this.pickedUnitIds.length === 0) {
            return []
        }
        const state = this.gameState
        const options: CommandKind[] = []
        const commander = group.commander
        const canCommand = commander !== undefined && commanderCanCommand(state, commander)
        const all = this.pickedUnitIds.length === group.units.length
        if (canCommand) {
            options.push(CommandKind.Corps)
            if (!all && commander.position !== undefined) {
                options.push(CommandKind.Detach)
            }
        }
        const detachable = commander === undefined || group.units.length > 1
        if (this.pickedUnitIds.length === 1 && detachable && independentCommandsLeft(state, playerId) > 0) {
            options.push(CommandKind.Unit)
        }
        return options
    })

    commandKind: CommandKind | undefined = $derived.by(() => {
        const chosen = this.selection.command?.value
        return chosen !== undefined && this.commandOptions.includes(chosen)
            ? chosen
            : this.commandOptions[0]
    })

    order: MoveOrder | undefined = $derived.by(() => {
        const group = this.selectedGroup
        const kind = this.commandKind
        if (!group || kind === undefined) {
            return undefined
        }
        return kind === CommandKind.Unit
            ? { kind, unitIds: this.pickedUnitIds }
            : { kind, commanderId: group.commander?.id, unitIds: this.pickedUnitIds }
    })

    /** Guard infantry in the order that can be shown to announce a Guard Attack (rule 11). */
    guardUnitId: string | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!playerId || this.gameState.getPlayerState(playerId).guardAttackForfeited) {
            return undefined
        }
        return this.pickedUnitIds.find((id) => this.gameState.unit(id).face?.guard === true)
    })

    guardAttack = $derived(this.selection.guard?.value === true && this.guardUnitId !== undefined)

    targets: MoveTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        const side = this.mySide
        if (this.isDeploying) {
            return this.detachmentTargets
        }
        if (this.retreatDraft) {
            return [...this.retreatDraft.room.keys()].map((locale) => ({
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

    /** Commanders standing with a unit that could take it into their corps (rule 9, Attach). */
    attachOptions(unit: ProjectedUnit): Commander[] {
        if (!this.isCommanding || unit.playerId !== this.myPlayerId || unit.fixed) {
            return []
        }
        const state = this.gameState
        return state.commandersOf(unit.playerId).filter(
            (commander) =>
                commander.id !== unit.commanderId &&
                commander.position !== undefined &&
                samePosition(commander.position, unit.position) &&
                commanderCanCommand(state, commander) &&
                state.corpsUnits(commander.id).length < MAX_CORPS_UNITS &&
                (unit.commanderId === undefined || state.corpsUnits(unit.commanderId).length > 1)
        )
    }

    /** A block's face as the viewer may see it: their own, or one the enemy has had to show. */
    visibleFace(unit: ProjectedUnit): Face | undefined {
        return unit.playerId === this.myPlayerId ? (unit.face ?? unit.shown) : unit.shown
    }

    isMine(group: PieceGroup): boolean {
        return group.playerId === this.myPlayerId
    }

    canSelect(group: PieceGroup): boolean {
        return this.isCommanding && this.isMine(group)
    }

    selectGroup(group: PieceGroup) {
        if (!this.canSelect(group)) {
            return
        }
        if (this.selectedGroupKey === group.key) {
            this.selection = emptySelection()
            return
        }
        const movable = group.units.filter((unit) => canStillMove(this.gameState, unit))
        const picked = group.commander ? movable : movable.slice(0, 1)
        this.selection = setCommandSelection(
            setCommandSelection(emptySelection(), 'group', group.key, 'manual'),
            'units',
            picked.map((unit) => unit.id),
            'auto'
        )
    }

    selectReinforcement(commanderId: string) {
        const reinforcement = this.reinforcements.find(
            (candidate) => candidate.commander.id === commanderId
        )
        if (!reinforcement) {
            return
        }
        this.selection = setCommandSelection(
            setCommandSelection(emptySelection(), 'group', reinforcementKey(commanderId), 'manual'),
            'units',
            reinforcement.units.map((unit) => unit.id),
            'auto'
        )
    }

    togglePickedUnit(unitId: string) {
        const group = this.selectedGroup
        if (!group || !group.units.some((unit) => unit.id === unitId)) {
            return
        }
        const picked = this.pickedUnitIds.includes(unitId)
            ? this.pickedUnitIds.filter((id) => id !== unitId)
            : group.commander
              ? [...this.pickedUnitIds, unitId]
              : [unitId]
        this.selection = setCommandSelection(this.selection, 'units', picked, 'manual')
    }

    chooseCommand(kind: CommandKind) {
        if (this.commandOptions.includes(kind)) {
            this.selection = setCommandSelection(this.selection, 'command', kind, 'manual')
        }
    }

    toggleGuardAttack() {
        this.selection = this.guardAttack
            ? clearCommandSelection(this.selection, 'guard')
            : setCommandSelection(this.selection, 'guard', true, 'manual')
    }

    clearSelection() {
        this.selection = emptySelection()
    }

    async chooseTarget(target: MoveTarget) {
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
        this.selection = emptySelection()
        await this.applyAction(
            this.createPlayerAction(Move, {
                order: { ...order, road: target.road, entryId: target.entryId },
                to: target.position
            })
        )
    }

    private async threaten(approach: number | undefined, order: MoveOrder) {
        if (approach === undefined || !this.validActionTypes.includes(ActionType.ThreatenAttack)) {
            return
        }
        const guardUnitId = this.guardAttack ? this.guardUnitId : undefined
        this.plannedOrder = order
        this.selection = emptySelection()
        await this.applyAction(
            this.createPlayerAction(ThreatenAttack, guardUnitId ? { approach, guardUnitId } : { approach })
        )
    }

    async attach(commanderId: string, unitId: string) {
        if (!this.validActionTypes.includes(ActionType.Attach)) {
            return
        }
        this.selection = emptySelection()
        await this.applyAction(this.createPlayerAction(Attach, { commanderId, unitId }))
    }

    /** Where the picked set-up unit could be detached to (rule 6, step 8). */
    private detachmentTargets: MoveTarget[] = $derived.by(() => {
        const deployment = this.deployment
        const unitId = this.setupUnitId
        const playerId = this.myPlayerId
        if (!deployment || !unitId || !playerId || this.mySide !== Side.French) {
            return []
        }
        const corps = deployment.corps.find((entry) => entry.unitIds.includes(unitId))
        const home = corps && !corps.offMap ? this.gameState.map.setupLocale(corps.commanderId) : undefined
        const already = deployment.detachments.some((entry) => entry.unitId === unitId)
        if (!home || (!already && deployment.detachments.length >= MAX_FRENCH_DETACHMENTS)) {
            return []
        }
        const map = this.gameState.map
        const targets: MoveTarget[] = []
        for (const locale of map.allLocales) {
            const distance = map.distance(home.id, locale.id)
            if (distance === undefined || distance > DETACHMENT_REACH) {
                continue
            }
            const positions: Position[] = [
                { locale: locale.id },
                ...map.passableApproachesOf(locale.id).map((approach) => ({ locale: locale.id, approach: approach.id }))
            ]
            for (const position of positions) {
                if (this.detachmentLegal(deployment, unitId, position, playerId)) {
                    const kind = position.approach === undefined ? TargetKind.Reserve : TargetKind.Approach
                    targets.push({ key: `${kind}:${position.locale}:${position.approach ?? 'r'}`, kind, position })
                }
            }
        }
        return targets
    })

    private detachmentLegal(deployment: Deployment, unitId: string, position: Position, playerId: string): boolean {
        const candidate: Deployment = {
            ...deployment,
            detachments: [...deployment.detachments.filter((entry) => entry.unitId !== unitId), { unitId, position }],
            fixedBattery: deployment.fixedBattery?.unitId === unitId ? undefined : deployment.fixedBattery
        }
        const preview = new HydratedNapoleonsTriumphGameState(structuredClone(this.gameState.dehydrate()))
        try {
            deployArmy(preview, playerId, this.withBattery(candidate))
            return true
        } catch {
            return false
        }
    }

    /** Keeps a French draft naming a fixed battery, as the rules require whenever artillery is on the map. */
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
        const approach = wanted !== undefined && approaches.includes(wanted) ? wanted : (standing ?? approaches[0])
        return { ...deployment, fixedBattery: { unitId: chosen.unitId, approach: standing === approach ? undefined : approach } }
    }

    private editSetup(change: (deployment: Deployment) => Deployment) {
        const deployment = this.deployment
        if (deployment) {
            this.setupDraft = this.withBattery(change(structuredClone($state.snapshot(deployment))))
        }
    }

    pickSetupUnit(unitId: string) {
        this.setupUnitId = this.setupUnitId === unitId ? undefined : unitId
    }

    /** Moves the picked unit into another corps, undoing any detachment of it. */
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
        this.setupUnitId = undefined
    }

    private detachTo(position: Position) {
        const unitId = this.setupUnitId
        if (!unitId) {
            return
        }
        this.editSetup((deployment) => ({
            ...deployment,
            detachments: [...deployment.detachments.filter((entry) => entry.unitId !== unitId), { unitId, position }]
        }))
        this.setupUnitId = undefined
    }

    recallDetachment(unitId: string) {
        this.editSetup((deployment) => ({
            ...deployment,
            detachments: deployment.detachments.filter((entry) => entry.unitId !== unitId)
        }))
    }

    setCorpsApproach(commanderId: string, approach: number | undefined) {
        this.editSetup((deployment) => ({
            ...deployment,
            corps: deployment.corps.map((corps) =>
                corps.commanderId === commanderId ? { ...corps, approach } : corps
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
                    : { commanderId: corps.commanderId, unitIds: corps.unitIds, offMap: true as const }
            })
        }))
    }

    nameFixedBattery(unitId: string, approach?: number) {
        this.editSetup((deployment) => ({ ...deployment, fixedBattery: { unitId, approach } }))
    }

    resetSetup() {
        this.setupDraft = undefined
        this.setupUnitId = undefined
    }

    async commitSetup() {
        const deployment = this.deployment
        if (deployment && this.setupPreview.state) {
            await this.deploy($state.snapshot(deployment))
            this.resetSetup()
        }
    }

    async deploy(deployment: Deployment) {
        if (!this.validActionTypes.includes(ActionType.DeployArmy)) {
            return
        }
        await this.applyAction(this.createPlayerAction(DeployArmy, { deployment }))
    }

    async deploySuggested() {
        const side = this.mySide
        if (side) {
            await this.deploy(suggestedDeployment(this.gameState, side))
        }
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

    async endTurn() {
        if (!this.validActionTypes.includes(ActionType.EndTurn)) {
            return
        }
        this.selection = emptySelection()
        await this.applyAction(this.createPlayerAction(EndTurn, {}))
    }

    async declareDefense(unitIds: string[], leaderIds: string[]) {
        await this.applyAction(this.createPlayerAction(DeclareDefense, { unitIds, leaderIds }))
    }

    async retreat(plan: RetreatPlan) {
        await this.applyAction(
            this.createPlayerAction(Retreat, {
                losses: { ...plan.losses },
                destinations: { ...plan.destinations },
                kept: { ...plan.kept }
            })
        )
    }

    async feint(orders: MoveOrder[], end: FeintEnd) {
        await this.applyAction(this.createPlayerAction(DeclareFeint, { orders, end }))
    }

    async pressAttack() {
        await this.applyAction(this.createPlayerAction(PressAttack, {}))
    }

    async declareAttack(orders: MoveOrder[], wide: boolean, leaderIds: string[], targetLeaderId?: string) {
        await this.applyAction(
            this.createPlayerAction(DeclareAttack, { orders, wide, leaderIds, targetLeaderId })
        )
    }

    async counterAttack(unitIds: string[]) {
        await this.applyAction(this.createPlayerAction(CounterAttack, { unitIds }))
    }

    async assignLosses(allocation: Record<string, number>) {
        await this.applyAction(this.createPlayerAction(AssignLosses, { allocation }))
    }

    async regroup(keep: Record<string, string>) {
        await this.applyAction(this.createPlayerAction(Regroup, { keep }))
    }

    async advance(unitIds: string[], commanderIds: string[]) {
        await this.applyAction(this.createPlayerAction(Advance, { unitIds, commanderIds }))
    }

    async occupy(orders: MoveOrder[], artilleryStays: boolean) {
        await this.applyAction(
            this.createPlayerAction(Occupy, artilleryStays ? { orders, artilleryStays } : { orders })
        )
    }

    /** The retreat the defender is arranging, when one is in front of them. */
    retreatDraft: RetreatDraft | undefined = $derived.by(() => {
        const attack = this.attack
        if (!attack || !this.canAct) {
            return undefined
        }
        const planning =
            attack.step === AttackStep.Retreating ||
            (attack.step === AttackStep.DefenseResponse && this.battleDraft.retreating)
        return planning ? retreatDraft(this.gameState, this.battleDraft) : undefined
    })

    /** Sends the picked retreating unit to a locale, or every unit there when none is picked. */
    sendRetreatTo(locale: number) {
        const plan = this.retreatDraft
        if (!plan || !plan.room.has(locale)) {
            return
        }
        const unitId = this.battleDraft.retreatUnitId
        const moved = unitId ? [unitId] : plan.survivors.map((unit) => unit.id)
        this.updateBattleDraft({
            destinations: { ...plan.destinations, ...Object.fromEntries(moved.map((id) => [id, locale])) },
            retreatUnitId: undefined
        })
    }

    async commitRetreat() {
        const plan = this.retreatDraft
        if (plan?.lossesValid) {
            await this.retreat({ losses: plan.losses, destinations: plan.destinations, kept: plan.kept })
        }
    }

    canPickInBattle(unitId: string): boolean {
        const retreat = this.retreatDraft
        if (retreat) {
            return retreat.room.size > 1 && retreat.destinations[unitId] !== undefined
        }
        return this.battleStage?.candidates.some((unit) => unit.id === unitId) === true
    }

    async pickBattleUnit(unitId: string) {
        if (!this.canPickInBattle(unitId)) {
            return
        }
        if (this.retreatDraft) {
            const alone = this.battleDraft.retreatUnitId
            this.updateBattleDraft({ retreatUnitId: alone === unitId ? undefined : unitId })
            return
        }
        const stage = this.battleStage
        if (!stage || !this.canPickInBattle(unitId)) {
            return
        }
        if (stage.immediateLoss !== undefined) {
            await this.assignLosses({ [unitId]: stage.immediateLoss })
            return
        }
        this.updateBattleDraft(stage.pick(unitId))
    }

    updateBattleDraft(change: Partial<BattleDraft>) {
        this.battleDraft = { ...this.battleDraft, ...change, touched: true }
    }

    hasManualSelection(): boolean {
        if (this.isDeploying) {
            return this.setupDraft !== undefined || this.setupUnitId !== undefined
        }
        if (this.attack && this.canAct) {
            return this.battleDraft.touched
        }
        return this.isCommanding && hasManualCommandSelection(this.selection)
    }

    override async undo() {
        if (this.isDeploying && this.hasManualSelection()) {
            if (this.setupUnitId !== undefined) {
                this.setupUnitId = undefined
            } else {
                this.setupDraft = undefined
            }
            return
        }
        if (this.attack && this.canAct && this.battleDraft.touched) {
            this.battleDraft = emptyBattleDraft()
            return
        }
        if (this.hasManualSelection()) {
            this.selection = popCommandSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = clearCommandSelection(this.selection, 'group')
        this.battleDraft = emptyBattleDraft()
    }

    override beforeNewState(): void {
        this.resetAction()
    }
}

export function reinforcementKey(commanderId: string): string {
    return `reinforcement|${commanderId}`
}
