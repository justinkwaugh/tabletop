import { ActionSource } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    BOARD_COLS,
    BOARD_ROWS,
    ChooseAction,
    detectNewRegions,
    DrawActionCard,
    ExpandRegion,
    getSquare,
    HydratedChooseAction,
    HydratedDrawActionCard,
    HydratedExpandRegion,
    HydratedLowenherzGameState,
    HydratedNegotiationMove,
    HydratedPlaceCastle,
    HydratedPlaceKnight,
    HydratedPlaceWall,
    HydratedSubmitDuelBid,
    isOnBoard,
    isWalledBetween,
    LowenherzGameState,
    MachineState,
    manhattanDistance,
    NegotiationMove,
    NegotiationMoveKind,
    neighbors,
    Pass,
    PlaceCastle,
    PlaceKnight,
    PlaceWall,
    Region,
    removeInteriorWalls,
    scoreRegion,
    SubmitDuelBid,
    wallBetween
} from '@tabletop/lowenherz'

export class LowenherzGameSession extends GameSession<
    LowenherzGameState,
    HydratedLowenherzGameState
> {
    // The castle square tentatively picked, while waiting for the player to pick the
    // adjacent knight square that completes a PlaceCastle action.
    selectedCastleSquare: { col: number; row: number } | undefined = $state(undefined)

    // A friendly message describing why the last placement attempt was rejected, shown
    // in the UI instead of letting the engine's validation error surface as a raw crash.
    errorMessage: string | undefined = $state(undefined)

    get canPlaceCastle(): boolean {
        if (!this.myPlayer) return false
        return HydratedPlaceCastle.canPlaceCastle(this.gameState, this.myPlayer.id)
    }

    get setupComplete(): boolean {
        return this.gameState.machineState !== MachineState.PlacingCastles
    }

    // All castle squares the current player could legally pick right now - used to
    // highlight legal spots on the board before a castle square is even selected.
    get legalCastleSquares(): { col: number; row: number }[] {
        if (!this.myPlayer || !this.canPlaceCastle) return []
        return HydratedPlaceCastle.legalCastleSquares(this.gameState, this.myPlayer.id)
    }

    // Validates the castle square the moment it's picked, rather than waiting until the
    // knight square is also chosen - so the gap/terrain/occupancy rules are enforced
    // immediately instead of only surfacing after a second click.
    selectCastleSquare(col: number, row: number) {
        if (!this.myPlayer || !HydratedPlaceCastle.isValidCastleSquare(this.gameState, this.myPlayer.id, col, row)) {
            this.errorMessage =
                "That spot isn't allowed for a castle — it needs to be at least 6 spaces from your other same-color castles, and can't be a hill, village, or an already-occupied square."
            return
        }

        this.errorMessage = undefined
        this.selectedCastleSquare = { col, row }
    }

    clearCastleSelection() {
        this.selectedCastleSquare = undefined
    }

    async placeCastleWithKnight(knightCol: number, knightRow: number) {
        const castleSquare = this.selectedCastleSquare
        if (!castleSquare) return

        const action = this.createPlayerAction(PlaceCastle, {
            castleCol: castleSquare.col,
            castleRow: castleSquare.row,
            knightCol,
            knightRow
        })

        // Check legality client-side first, using the same rule the engine enforces, so
        // an illegal attempt gets a friendly message instead of the engine's assert()
        // throwing (that throw is meant to catch programming bugs, not expected
        // rule-violation attempts from a player experimenting with the board).
        const candidate = new HydratedPlaceCastle({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceCastle,
            playerId: action.playerId,
            castleCol: castleSquare.col,
            castleRow: castleSquare.row,
            knightCol,
            knightRow
        })

        if (!candidate.isValidPlaceCastle(this.gameState)) {
            this.errorMessage =
                "That knight square isn't allowed — it must be directly adjacent to the castle, empty, and not a hill or village. Pick a different spot."
            this.clearCastleSelection()
            return
        }

        this.errorMessage = undefined
        this.clearCastleSelection()
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to place castle/knight:', e)
            this.errorMessage = 'That placement was rejected. Please try a different spot.'
        }
    }

    // Testing convenience only - not a real player action. Repeatedly picks a
    // legal castle+knight spot for whichever player is currently up, so setup can be
    // skipped past quickly while testing later phases. Works in hotseat mode because
    // canPlaceCastle/myPlayer already track whichever player is active.
    async autoPlaceAllCastles() {
        while (this.canPlaceCastle) {
            const candidates = this.legalCastleSquares
            if (candidates.length === 0) break
            const castleSquare = this.pickSpreadOutCastleSquare(candidates)

            const knightSquare = neighbors(castleSquare.col, castleSquare.row).find((n) =>
                HydratedPlaceCastle.isValidKnightSquare(
                    this.gameState,
                    castleSquare.col,
                    castleSquare.row,
                    n.col,
                    n.row
                )
            )
            if (!knightSquare) break

            this.selectCastleSquare(castleSquare.col, castleSquare.row)
            await this.placeCastleWithKnight(knightSquare.col, knightSquare.row)
        }
    }

    // All castle squares currently on the board, any color - used both to spread out
    // auto-placed castles and to find seed-able castle+knight pairs for
    // seedTestRegions().
    private allCastleSquares(): { col: number; row: number }[] {
        const result: { col: number; row: number }[] = []
        for (let row = 0; row < this.gameState.board.squares.length; row++) {
            for (let col = 0; col < this.gameState.board.squares[row].length; col++) {
                if (this.gameState.board.squares[row][col].castleColor) result.push({ col, row })
            }
        }
        return result
    }

    // legalCastleSquares scans the board in plain row-major order, so always picking
    // its first result clusters every auto-placed castle into the first few rows.
    // Instead, pick whichever legal candidate is farthest (by minimum distance) from
    // every castle already on the board - a simple farthest-point spread - so testing
    // runs get castles distributed across the whole map. The very first castle has
    // nothing to spread from yet, so it's placed nearest the board's center instead,
    // leaving room for the rest to spread around it.
    private pickSpreadOutCastleSquare(candidates: { col: number; row: number }[]): {
        col: number
        row: number
    } {
        const existingCastles = this.allCastleSquares()

        if (existingCastles.length === 0) {
            const center = { col: Math.floor(BOARD_COLS / 2), row: Math.floor(BOARD_ROWS / 2) }
            return candidates.reduce((best, c) =>
                manhattanDistance(c.col, c.row, center.col, center.row) <
                manhattanDistance(best.col, best.row, center.col, center.row)
                    ? c
                    : best
            )
        }

        const minDistanceToExisting = (c: { col: number; row: number }) =>
            Math.min(...existingCastles.map((e) => manhattanDistance(c.col, c.row, e.col, e.row)))

        return candidates.reduce((best, c) =>
            minDistanceToExisting(c) > minDistanceToExisting(best) ? c : best
        )
    }

    // Testing convenience only - not a real player action, and not a real Boundary
    // Walls action either. Encloses one castle+knight pair per distinct color already
    // on the board (skipping colors that already own a region) into a minimal walled
    // region, exactly like a real wall placement would score it - so expansion and
    // invasion can be tested right after setup, without first playing through card
    // draws and negotiations/duels to actually win a border action. Idempotent - safe
    // to call again later, since it only touches colors that don't already have a
    // region (e.g. call it again after an invasion strands a color's whole region to
    // give them a fresh foothold).
    async seedTestRegions() {
        if (!this.setupComplete) return

        const board = this.gameState.board
        const alreadyOwnedColors = new Set(this.gameState.regions.map((r) => r.ownerColor).filter(Boolean))

        const seedPairs = new Map<
            string,
            { castle: { col: number; row: number }; knight: { col: number; row: number } }
        >()
        for (const castle of this.allCastleSquares()) {
            const color = getSquare(board, castle.col, castle.row)?.castleColor
            if (!color || alreadyOwnedColors.has(color) || seedPairs.has(color)) continue

            const knight = neighbors(castle.col, castle.row).find(
                (n) => isOnBoard(n.col, n.row) && getSquare(board, n.col, n.row)?.knightColor === color
            )
            if (!knight) continue

            seedPairs.set(color, { castle, knight })
        }

        if (seedPairs.size === 0) return

        for (const { castle, knight } of seedPairs.values()) {
            for (const cell of [castle, knight]) {
                const partner = cell === castle ? knight : castle
                for (const n of neighbors(cell.col, cell.row)) {
                    if (!isOnBoard(n.col, n.row)) continue
                    if (n.col === partner.col && n.row === partner.row) continue // shared edge stays open
                    if (isWalledBetween(board, cell.col, cell.row, n.col, n.row)) continue

                    const wall = wallBetween(cell.col, cell.row, n.col, n.row)
                    if (wall) board.walls.push(wall)
                }
            }
        }

        const newRegions = detectNewRegions(board, this.gameState.regions)
        for (const region of newRegions) {
            const points = region.ownerColor ? scoreRegion(region, board) : 0
            if (region.ownerColor) {
                const owner = this.gameState.players.find((p) => p.color === region.ownerColor)
                if (owner) owner.powerPoints += points
            }
            this.gameState.regions.push(region)
            removeInteriorWalls(board, region)
        }

        await this.setGameState(this.gameState.dehydrate())
    }

    get canDrawActionCard(): boolean {
        if (!this.myPlayer) return false
        return HydratedDrawActionCard.canDrawActionCard(this.gameState, this.myPlayer.id)
    }

    async drawActionCard() {
        if (!this.canDrawActionCard) return

        const action = this.createPlayerAction(DrawActionCard, {})
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to draw action card:', e)
            this.errorMessage = 'Could not draw the next action card.'
        }
    }

    get canChooseAction(): boolean {
        if (!this.myPlayer) return false
        return HydratedChooseAction.canChooseAction(this.gameState, this.myPlayer.id)
    }

    async chooseAction(slot: 1 | 2 | 3) {
        if (!this.canChooseAction) return

        const action = this.createPlayerAction(ChooseAction, { slot })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to choose action:', e)
            this.errorMessage = 'That choice was rejected.'
        }
    }

    get isMyNegotiationTurn(): boolean {
        if (!this.myPlayer) return false
        return this.gameState.negotiation?.turnPlayerId === this.myPlayer.id
    }

    private async submitNegotiationMove(kind: NegotiationMoveKind, amount?: number) {
        if (!this.isMyNegotiationTurn) return

        const action = this.createPlayerAction(NegotiationMove, { kind, amount })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed negotiation move:', e)
            this.errorMessage = 'That move was rejected.'
        }
    }

    async makeOffer(amount: number) {
        if (!this.myPlayer) return
        const candidate = new HydratedNegotiationMove({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.NegotiationMove,
            playerId: this.myPlayer.id,
            kind: NegotiationMoveKind.Offer,
            amount
        })
        if (!candidate.isValidNegotiationMove(this.gameState)) {
            this.errorMessage = "That offer isn't allowed — it must be a whole number of ducats you can afford."
            return
        }
        await this.submitNegotiationMove(NegotiationMoveKind.Offer, amount)
    }

    async acceptOffer() {
        await this.submitNegotiationMove(NegotiationMoveKind.Accept)
    }

    async declineNegotiation() {
        await this.submitNegotiationMove(NegotiationMoveKind.Decline)
    }

    get canSubmitDuelBid(): boolean {
        if (!this.myPlayer) return false
        const duel = this.gameState.duel
        if (!duel) return false
        return duel.playerIds.includes(this.myPlayer.id) && !duel.bids.some((b) => b.playerId === this.myPlayer!.id)
    }

    async submitDuelBid(amount: number) {
        if (!this.myPlayer || !this.canSubmitDuelBid) return

        const candidate = new HydratedSubmitDuelBid({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.SubmitDuelBid,
            playerId: this.myPlayer.id,
            amount
        })
        if (!candidate.isValidSubmitDuelBid(this.gameState)) {
            this.errorMessage = "That bid isn't allowed — it must be a whole number of ducats you can afford."
            return
        }

        const action = this.createPlayerAction(SubmitDuelBid, { amount })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to submit duel bid:', e)
            this.errorMessage = 'That bid was rejected.'
        }
    }

    get canPlaceWall(): boolean {
        if (!this.myPlayer) return false
        return (
            this.gameState.machineState === MachineState.PlacingWalls &&
            this.gameState.wallPlacingPlayerId === this.myPlayer.id
        )
    }

    private isValidWallBetween(col1: number, row1: number, col2: number, row2: number): boolean {
        if (!this.myPlayer) return false
        const candidate = new HydratedPlaceWall({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceWall,
            playerId: this.myPlayer.id,
            col1,
            row1,
            col2,
            row2
        })
        return candidate.isValidPlaceWall(this.gameState)
    }

    // Every currently-legal wall position, as the pair of squares it separates - one
    // entry per edge (not per square), so the board can render a single clickable line
    // directly on the boundary rather than requiring a two-click square-then-square
    // flow. Computed once per access (not re-entered per edge), matching the
    // legalCastleSquares pattern.
    get legalWallEdges(): { col1: number; row1: number; col2: number; row2: number }[] {
        if (!this.canPlaceWall) return []
        const result: { col1: number; row1: number; col2: number; row2: number }[] = []
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (col + 1 < BOARD_COLS && this.isValidWallBetween(col, row, col + 1, row)) {
                    result.push({ col1: col, row1: row, col2: col + 1, row2: row })
                }
                if (row + 1 < BOARD_ROWS && this.isValidWallBetween(col, row, col, row + 1)) {
                    result.push({ col1: col, row1: row, col2: col, row2: row + 1 })
                }
            }
        }
        return result
    }

    async placeWallBetween(col1: number, row1: number, col2: number, row2: number) {
        if (!this.canPlaceWall) return

        const action = this.createPlayerAction(PlaceWall, { col1, row1, col2, row2 })

        const candidate = new HydratedPlaceWall({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceWall,
            playerId: action.playerId,
            col1,
            row1,
            col2,
            row2
        })

        const invalidReason = candidate.invalidPlaceWallReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to place wall:', e)
            this.errorMessage = 'That wall was rejected.'
        }
    }

    // Voluntarily stops placing walls before the full allotment is used - "may place
    // as many boundary walls as shown" (never "must"), same optionality the rulebook
    // gives every action in this phase.
    async passWallPlacement() {
        if (!this.canPlaceWall) return

        const action = this.createPlayerAction(Pass, {})
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to pass wall placement:', e)
            this.errorMessage = 'Could not pass.'
        }
    }

    get canPlaceKnight(): boolean {
        if (!this.myPlayer) return false
        return (
            this.gameState.machineState === MachineState.PlacingKnights &&
            this.gameState.knightPlacingPlayerId === this.myPlayer.id
        )
    }

    // Every square the current player could legally place a knight on right now -
    // highlighted before it's clicked, same pattern as legalCastleSquares.
    get legalKnightSquares(): { col: number; row: number }[] {
        if (!this.myPlayer || !this.canPlaceKnight) return []
        const result: { col: number; row: number }[] = []
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const candidate = new HydratedPlaceKnight({
                    id: 'candidate',
                    gameId: this.gameState.gameId,
                    source: ActionSource.User,
                    type: ActionType.PlaceKnight,
                    playerId: this.myPlayer.id,
                    col,
                    row
                })
                if (candidate.isValidPlaceKnight(this.gameState)) result.push({ col, row })
            }
        }
        return result
    }

    async placeKnight(col: number, row: number) {
        if (!this.canPlaceKnight || !this.myPlayer) return

        const action = this.createPlayerAction(PlaceKnight, { col, row })

        const candidate = new HydratedPlaceKnight({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceKnight,
            playerId: action.playerId,
            col,
            row
        })

        const invalidReason = candidate.invalidPlaceKnightReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to place knight:', e)
            this.errorMessage = 'That knight placement was rejected.'
        }
    }

    // Voluntarily stops placing knights (or expanding a region) before using the full
    // allotment - "may either place a knight... or extend a region" (never "must"),
    // same optionality the rulebook gives every action in this phase.
    async passKnightPlacement() {
        if (!this.canPlaceKnight) return
        this.cancelExpansion()

        const action = this.createPlayerAction(Pass, {})
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to pass knight placement:', e)
            this.errorMessage = 'Could not pass.'
        }
    }

    get myRegions(): Region[] {
        if (!this.myPlayer) return []
        const myColor = this.gameState.getPlayerState(this.myPlayer.id).color
        return this.gameState.regions.filter((r) => r.ownerColor === myColor)
    }

    get canExpandRegion(): boolean {
        return this.canPlaceKnight && this.myRegions.length > 0
    }

    // The region currently being expanded (auto-selected if the player only owns one),
    // and the 1-2 spaces picked so far for that expansion.
    selectedExpandRegionId: string | undefined = $state(undefined)
    expansionSquares: { col: number; row: number }[] = $state([])

    selectRegionToExpand(regionId: string) {
        if (!this.canExpandRegion) return
        this.errorMessage = undefined
        this.selectedExpandRegionId = regionId
        this.expansionSquares = []
    }

    cancelExpansion() {
        this.selectedExpandRegionId = undefined
        this.expansionSquares = []
    }

    private isValidExpansionAttempt(regionId: string, spaces: { col: number; row: number }[]): boolean {
        if (!this.myPlayer) return false
        // spaces is (or is derived from) the $state array expansionSquares - its
        // elements are Svelte reactive proxies, which the Hydratable base class can't
        // structuredClone. Snapshot to plain data first.
        const plainSpaces = $state.snapshot(spaces)
        const candidate = new HydratedExpandRegion({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.ExpandRegion,
            playerId: this.myPlayer.id,
            regionId,
            spaces: plainSpaces
        })
        return candidate.isValidExpandRegion(this.gameState)
    }

    // Squares that would legally extend the region-in-progress, given whatever's
    // already been picked (adjacent to the original region for the 1st pick, or to
    // the region as extended by the 1st pick for the 2nd) - never more than 2 total.
    get legalNextExpansionSquares(): { col: number; row: number }[] {
        const regionId = this.selectedExpandRegionId
        if (!regionId || this.expansionSquares.length >= 2) return []

        const result: { col: number; row: number }[] = []
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (this.isValidExpansionAttempt(regionId, [...this.expansionSquares, { col, row }])) {
                    result.push({ col, row })
                }
            }
        }
        return result
    }

    addExpansionSquare(col: number, row: number) {
        if (!this.selectedExpandRegionId || this.expansionSquares.length >= 2) return
        this.expansionSquares = [...this.expansionSquares, { col, row }]
    }

    async confirmExpansion() {
        const regionId = this.selectedExpandRegionId
        if (!regionId || this.expansionSquares.length === 0 || !this.myPlayer) return

        const spaces = $state.snapshot(this.expansionSquares)
        const action = this.createPlayerAction(ExpandRegion, { regionId, spaces })

        if (!this.isValidExpansionAttempt(regionId, spaces)) {
            const candidate = new HydratedExpandRegion({
                id: 'candidate',
                gameId: this.gameState.gameId,
                source: ActionSource.User,
                type: ActionType.ExpandRegion,
                playerId: this.myPlayer.id,
                regionId,
                spaces
            })
            this.errorMessage = candidate.invalidExpandRegionReason(this.gameState)
            this.cancelExpansion()
            return
        }

        this.errorMessage = undefined
        this.cancelExpansion()
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to expand region:', e)
            this.errorMessage = 'That expansion was rejected.'
        }
    }

    // Testing convenience only - not a real player action. Drives the round loop
    // forward using real actions (drawing cards, picking decisions, accepting/offering
    // in negotiations, bidding in duels) until wall or knight placement begins, so
    // those results can be tested repeatedly without manually grinding through the
    // whole card/negotiation/duel flow each time. Works in hotseat mode because
    // canX/myPlayer already track whichever player is active.
    async autoAdvanceToActionEffect() {
        if (this.gameState.machineState === MachineState.PlacingCastles) return

        const MAX_STEPS = 300
        for (let i = 0; i < MAX_STEPS; i++) {
            if (this.gameState.machineState === MachineState.PlacingWalls) return
            if (this.gameState.machineState === MachineState.PlacingKnights) return
            if (this.gameState.machineState === MachineState.EndOfGame) return

            if (this.canDrawActionCard) {
                await this.drawActionCard()
                continue
            }

            if (this.canChooseAction && this.myPlayer) {
                const usedSlots = new Set(
                    this.gameState.decisions
                        .filter((d) => d.playerId === this.myPlayer!.id)
                        .map((d) => d.slot)
                )
                // Cycle 1/2/3 across successive decisions this round (rather than
                // everyone defaulting to the lowest unused slot) so slots 2 and 3 -
                // where border actions live - actually get picked sometimes. With
                // only 1 decision per player in a 4-player game, "lowest available"
                // meant every single player always picked slot 1, so border actions
                // in the middle/bottom band were never chosen at all.
                const preferred = ((this.gameState.decisions.length % 3) + 1) as 1 | 2 | 3
                const slot = usedSlots.has(preferred)
                    ? ([1, 2, 3] as const).find((s) => !usedSlots.has(s))
                    : preferred
                if (slot === undefined) break
                await this.chooseAction(slot)
                continue
            }

            if (this.isMyNegotiationTurn && this.myPlayer) {
                if (this.gameState.negotiation?.offer) {
                    await this.acceptOffer()
                } else {
                    const myMoney = this.gameState.getPlayerState(this.myPlayer.id).money
                    await this.makeOffer(Math.min(1, myMoney))
                }
                continue
            }

            if (this.canSubmitDuelBid && this.myPlayer) {
                const myMoney = this.gameState.getPlayerState(this.myPlayer.id).money
                await this.submitDuelBid(Math.min(Math.floor(Math.random() * 3), myMoney))
                continue
            }

            break // nothing left to automate - avoid spinning forever
        }
    }
}
