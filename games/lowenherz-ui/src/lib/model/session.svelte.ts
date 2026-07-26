import { ActionSource, createAction, type Color } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import { nanoid } from 'nanoid'
import {
    ActionType,
    ALLIANCE_CANCELLATION_COST,
    areRegionsAllied,
    BOARD_COLS,
    BOARD_ROWS,
    CancelAlliance,
    ChooseAction,
    detectNewRegions,
    DrawActionCard,
    ExpandRegion,
    getSquare,
    HydratedCancelAlliance,
    HydratedChooseAction,
    HydratedDrawActionCard,
    HydratedExpandRegion,
    HydratedLookAtPoliticsPile,
    HydratedLowenherzGameState,
    HydratedNegotiationMove,
    HydratedPlaceCastle,
    HydratedPlaceKnight,
    HydratedPlaceWall,
    HydratedPlayAllianceCard,
    HydratedPlayRenegadeCard,
    HydratedSubmitDuelBid,
    isKnightSafeToRemove,
    isOnBoard,
    isWalledBetween,
    LookAtPoliticsPile,
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
    PlayAllianceCard,
    PlayRenegadeCard,
    type PoliticsCard,
    PoliticsCardType,
    Region,
    regionsAreNeighboring,
    removeInteriorWalls,
    scoreRegion,
    squareKey,
    SquareType,
    SubmitDuelBid,
    TakePoliticsCard,
    HydratedTakePoliticsCard,
    wallBetween,
    WOODED_KNIGHT_COST
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
        if (!this.myPlayer) return

        const problem = HydratedPlaceCastle.describeCastleSquareProblem(this.gameState, this.myPlayer.id, col, row)
        if (problem) {
            this.errorMessage = {
                notYourTurn: "It's not your turn to place a castle right now.",
                wrongTerrain: "That spot isn't allowed for a castle — it can't be a hill or village.",
                occupied: "That spot isn't allowed for a castle — it's already occupied.",
                tooClose:
                    "That spot isn't allowed for a castle — it needs to be at least 6 spaces from your other same-color castles."
            }[problem]
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
    // Walls action either. Encloses castle+knight pairs not already part of a region
    // (one blob per castle, not just one per color - a color with several castles
    // gets several regions, up to MAX_SEEDED_REGIONS_PER_COLOR) and grows each blob
    // outward into open, unclaimed territory, so seeded regions are big enough and
    // numerous enough to reach multi-region expansion/invasion scenarios quickly,
    // without first playing through card draws and negotiations/duels to actually
    // win border actions. Deliberately stops short of every player's 3rd region so
    // border actions (PlacingWalls) stay testable too - a player already at the cap
    // can't place any more walls at all. Idempotent - safe to call again later (e.g.
    // after an invasion strands part of a region, or to seed any castle that still
    // has none) since it only touches castles that aren't already part of a tracked
    // region, and re-checks each color's current region count fresh every call.
    async seedTestRegions() {
        if (!this.setupComplete) return

        const TARGET_BLOB_SIZE = 8
        // Stop at 2 regions per color (not every castle) - leaves each player under
        // the rulebook's "3 regions" cap, so a seeded test game can still exercise
        // PlacingWalls/border actions instead of every player already being maxed out.
        const MAX_SEEDED_REGIONS_PER_COLOR = 2
        const board = this.gameState.board
        const claimedKeys = new Set(this.gameState.regions.flatMap((r) => r.squareKeys))

        const regionCountByColor = new Map<Color, number>()
        for (const region of this.gameState.regions) {
            if (!region.ownerColor) continue
            regionCountByColor.set(region.ownerColor, (regionCountByColor.get(region.ownerColor) ?? 0) + 1)
        }

        const blobs: { col: number; row: number }[][] = []
        for (const castle of this.allCastleSquares()) {
            if (claimedKeys.has(squareKey(castle.col, castle.row))) continue
            const color = getSquare(board, castle.col, castle.row)?.castleColor
            if (!color) continue
            if ((regionCountByColor.get(color) ?? 0) >= MAX_SEEDED_REGIONS_PER_COLOR) continue

            const knight = neighbors(castle.col, castle.row).find(
                (n) => isOnBoard(n.col, n.row) && getSquare(board, n.col, n.row)?.knightColor === color
            )
            if (!knight) continue

            const cells = [castle, knight]
            const cellKeys = new Set([squareKey(castle.col, castle.row), squareKey(knight.col, knight.row)])
            while (cells.length < TARGET_BLOB_SIZE) {
                const grownFrom = cells.find((cell) =>
                    neighbors(cell.col, cell.row).some((n) => {
                        if (!isOnBoard(n.col, n.row)) return false
                        const nKey = squareKey(n.col, n.row)
                        if (cellKeys.has(nKey) || claimedKeys.has(nKey)) return false
                        const sq = getSquare(board, n.col, n.row)
                        if (sq?.castleColor) return false // never absorb another castle
                        if (sq?.knightColor && sq.knightColor !== color) return false // foreign knight
                        return true
                    })
                )
                if (!grownFrom) break // no more room to grow near this blob

                const candidate = neighbors(grownFrom.col, grownFrom.row).find((n) => {
                    if (!isOnBoard(n.col, n.row)) return false
                    const nKey = squareKey(n.col, n.row)
                    if (cellKeys.has(nKey) || claimedKeys.has(nKey)) return false
                    const sq = getSquare(board, n.col, n.row)
                    if (sq?.castleColor) return false
                    if (sq?.knightColor && sq.knightColor !== color) return false
                    return true
                })!
                cells.push(candidate)
                cellKeys.add(squareKey(candidate.col, candidate.row))
            }

            cells.forEach((c) => claimedKeys.add(squareKey(c.col, c.row)))
            blobs.push(cells)
            regionCountByColor.set(color, (regionCountByColor.get(color) ?? 0) + 1)
        }

        if (blobs.length === 0) return

        for (const cells of blobs) {
            const cellSet = new Set(cells.map((c) => squareKey(c.col, c.row)))
            for (const cell of cells) {
                for (const n of neighbors(cell.col, cell.row)) {
                    if (!isOnBoard(n.col, n.row)) continue
                    if (cellSet.has(squareKey(n.col, n.row))) continue
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

    // Testing convenience only - not a real player action. Hands a Renegade card to
    // the current player (so they can immediately try playing it themselves) and an
    // Alliance card to a different player (so there's a second color to test
    // alliance-related interactions - like being targeted by Renegade, or cancelling
    // an alliance from that seat in hotseat mode) - without grinding through Crown and
    // Scepter draws to get them naturally.
    async giveTestPoliticsCards() {
        const players = this.gameState.players
        if (players.length < 2) return

        const mine = this.myPlayer ? this.gameState.getPlayerState(this.myPlayer.id) : players[0]
        const other = players.find((p) => p.playerId !== mine.playerId) ?? players[1]

        mine.politicsCards = [
            ...mine.politicsCards,
            { id: `test-renegade-${Math.random().toString(36).slice(2)}`, type: PoliticsCardType.Renegade }
        ]
        other.politicsCards = [
            ...other.politicsCards,
            { id: `test-alliance-${Math.random().toString(36).slice(2)}`, type: PoliticsCardType.Alliance }
        ]

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

    // Both negotiators are active at once - either can propose/sign/decline at any
    // time, not just "on their turn".
    get isNegotiator(): boolean {
        if (!this.myPlayer) return false
        return this.gameState.negotiation?.playerIds.includes(this.myPlayer.id) ?? false
    }

    get hasSignedNegotiationOffer(): boolean {
        if (!this.myPlayer) return false
        return this.gameState.negotiation?.signedPlayerIds.includes(this.myPlayer.id) ?? false
    }

    hasPlayerSignedNegotiationOffer(playerId: string): boolean {
        return this.gameState.negotiation?.signedPlayerIds.includes(playerId) ?? false
    }

    // A proposal names either negotiator as the payer ("I'll pay you" or "you pay
    // me") - it's a suggested deal shape, not necessarily an offer of your own money.
    async proposeNegotiationOffer(fromPlayerId: string, amount: number) {
        if (!this.myPlayer || !this.isNegotiator) return

        const candidate = new HydratedNegotiationMove({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.NegotiationMove,
            playerId: this.myPlayer.id,
            kind: NegotiationMoveKind.Propose,
            fromPlayerId,
            amount
        })
        if (!candidate.isValidNegotiationMove(this.gameState)) {
            this.errorMessage =
                "That offer isn't allowed — it must be a whole number of ducats the payer can afford."
            return
        }

        const action = this.createPlayerAction(NegotiationMove, {
            kind: NegotiationMoveKind.Propose,
            fromPlayerId,
            amount
        })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to propose negotiation offer:', e)
            this.errorMessage = 'That offer was rejected.'
        }
    }

    get canSignNegotiationOffer(): boolean {
        if (!this.isNegotiator) return false
        return this.gameState.negotiation?.offer !== undefined && !this.hasSignedNegotiationOffer
    }

    async signNegotiationOffer() {
        if (!this.canSignNegotiationOffer) return

        const action = this.createPlayerAction(NegotiationMove, { kind: NegotiationMoveKind.Sign })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to sign negotiation offer:', e)
            this.errorMessage = 'That signature was rejected.'
        }
    }

    async declineNegotiation() {
        if (!this.isNegotiator) return

        const action = this.createPlayerAction(NegotiationMove, { kind: NegotiationMoveKind.Decline })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to decline negotiation:', e)
            this.errorMessage = 'That move was rejected.'
        }
    }

    // TEMPORARY - a stand-in for real two-session testing, remove once that exists.
    // Both negotiators stay simultaneously active for the whole negotiation, but
    // hotseat's myPlayer only ever resolves to one of them (activePlayers.at(0)), so
    // there's normally no way for a single solo tester to supply the OTHER
    // negotiator's signature. This signs on their behalf directly, bypassing the
    // myPlayer check that signNegotiationOffer() enforces.
    async debugSignNegotiationOfferAs(playerId: string) {
        const negotiation = this.gameState.negotiation
        if (!negotiation?.offer || negotiation.signedPlayerIds.includes(playerId)) return

        const action = createAction(NegotiationMove, {
            id: nanoid(),
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.NegotiationMove,
            playerId,
            kind: NegotiationMoveKind.Sign
        })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to sign negotiation offer (debug):', e)
            this.errorMessage = 'That signature was rejected.'
        }
    }

    get canSubmitDuelBid(): boolean {
        if (!this.myPlayer) return false
        const duel = this.gameState.duel
        if (!duel) return false
        return duel.playerIds.includes(this.myPlayer.id) && !duel.bids.some((b) => b.playerId === this.myPlayer!.id)
    }

    hasPlayerBidInDuel(playerId: string): boolean {
        return this.gameState.duel?.bids.some((b) => b.playerId === playerId) ?? false
    }

    // This player's Treasure cards - usable to back a duel bid, or to cover the
    // wooded-knight cost, on top of (or instead of) ducats. Held cards aren't shown
    // for other players (see LowenherzPlayerState.politicsCards' comment).
    get myTreasureCards(): PoliticsCard[] {
        if (!this.myPlayer) return []
        return this.gameState
            .getPlayerState(this.myPlayer.id)
            .politicsCards.filter((c) => c.type === PoliticsCardType.Treasure)
    }

    async submitDuelBid(amount: number, treasureCardId?: string) {
        if (!this.myPlayer || !this.canSubmitDuelBid) return

        const candidate = new HydratedSubmitDuelBid({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.SubmitDuelBid,
            playerId: this.myPlayer.id,
            amount,
            ...(treasureCardId ? { treasureCardId } : {})
        })
        if (!candidate.isValidSubmitDuelBid(this.gameState)) {
            this.errorMessage = "That bid isn't allowed — it must be a whole number of ducats you can afford, backed by a Treasure card you actually hold (if any)."
            return
        }

        const action = this.createPlayerAction(SubmitDuelBid, {
            amount,
            ...(treasureCardId ? { treasureCardId } : {})
        })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to submit duel bid:', e)
            this.errorMessage = 'That bid was rejected.'
        }
    }

    // TEMPORARY - a stand-in for real two-session testing, remove once that exists.
    // Every duelist stays simultaneously active for the whole duel, but hotseat's
    // myPlayer only ever resolves to one of them (activePlayers.at(0)), so there's
    // normally no way for a solo tester to submit a bid for anyone else. This submits
    // one directly for a specific player, bypassing the myPlayer check that
    // submitDuelBid() enforces - unlike negotiation's Propose, a duel bid really is
    // tied to one specific bidder, so this stays debug-only rather than becoming a
    // real mechanic.
    async debugSubmitDuelBidAs(playerId: string, amount: number) {
        const duel = this.gameState.duel
        if (!duel || !duel.playerIds.includes(playerId) || this.hasPlayerBidInDuel(playerId)) return

        const action = createAction(SubmitDuelBid, {
            id: nanoid(),
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.SubmitDuelBid,
            playerId,
            amount
        })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to submit duel bid (debug):', e)
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

    // Armed Treasure card (if any) for the next wooded knight placement or duel bid -
    // purely local UI selection, same pattern as selectedExpandRegionId. Only actually
    // applied to a knight placement when the target square is wooded (see
    // placeKnight/legalKnightSquares) - arming one doesn't make other squares illegal.
    selectedTreasureCardId: string | undefined = $state(undefined)

    selectTreasureCard(cardId: string | undefined) {
        this.selectedTreasureCardId = cardId
    }

    private treasureCardIdFor(col: number, row: number): string | undefined {
        const square = getSquare(this.gameState.board, col, row)
        return square?.type === SquareType.Forest ? this.selectedTreasureCardId : undefined
    }

    // Every square the current player could legally place a knight on right now -
    // highlighted before it's clicked, same pattern as legalCastleSquares.
    get legalKnightSquares(): { col: number; row: number }[] {
        if (!this.myPlayer || !this.canPlaceKnight) return []
        const result: { col: number; row: number }[] = []
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const treasureCardId = this.treasureCardIdFor(col, row)
                const candidate = new HydratedPlaceKnight({
                    id: 'candidate',
                    gameId: this.gameState.gameId,
                    source: ActionSource.User,
                    type: ActionType.PlaceKnight,
                    playerId: this.myPlayer.id,
                    col,
                    row,
                    ...(treasureCardId ? { treasureCardId } : {})
                })
                if (candidate.isValidPlaceKnight(this.gameState)) result.push({ col, row })
            }
        }
        return result
    }

    async placeKnight(col: number, row: number) {
        if (!this.canPlaceKnight || !this.myPlayer) return

        const treasureCardId = this.treasureCardIdFor(col, row)
        const action = this.createPlayerAction(PlaceKnight, {
            col,
            row,
            ...(treasureCardId ? { treasureCardId } : {})
        })

        const candidate = new HydratedPlaceKnight({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceKnight,
            playerId: action.playerId,
            col,
            row,
            ...(treasureCardId ? { treasureCardId } : {})
        })

        const invalidReason = candidate.invalidPlaceKnightReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        this.selectedTreasureCardId = undefined
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

    // Picking a 2nd space always maxes out this expansion (never more than 2 - "using
    // this card to expand twice is not allowed" already means one card only ever
    // grants 1-2 spaces total), so there's nothing left to decide once it's picked -
    // submit immediately rather than making the player click Confirm too. Undo is
    // there if they change their mind. A 1-space expansion still waits for an
    // explicit Confirm/Cancel, since the player might want to add a 2nd space instead.
    async addExpansionSquare(col: number, row: number) {
        if (!this.selectedExpandRegionId || this.expansionSquares.length >= 2) return
        this.expansionSquares = [...this.expansionSquares, { col, row }]
        if (this.expansionSquares.length >= 2) {
            await this.confirmExpansion()
        }
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

    get canTakePoliticsCard(): boolean {
        if (!this.myPlayer) return false
        return (
            this.gameState.machineState === MachineState.TakingPoliticsCard &&
            this.gameState.politicsTakingPlayerId === this.myPlayer.id
        )
    }

    // Which pile (if either) the current player has committed to looking through -
    // this is now real server state (set by LookAtPoliticsPile, cleared by
    // takePoliticsCard()) rather than local-only UI state, so it survives undo: if
    // the player undoes their TakePoliticsCard pick, this stays put and they can pick
    // a different card from the SAME pile. Per the rulebook ("look through one of the
    // two piles... and select one card"), opening a pile is a one-way commitment -
    // there's no way to switch to the other pile once this is set.
    get selectedPoliticsPile(): 'A' | 'B' | undefined {
        return this.gameState.openedPoliticsPile
    }

    // Whether the fanned-out pile view is currently showing - separate from WHICH
    // pile is selected, so a player can hide it (to see the board underneath) and
    // bring the same pile back up without that counting as backing out of their
    // choice. Purely local - showing/hiding this view isn't a game action.
    showPoliticsHand: boolean = $state(false)

    // Viewport-space center point of whichever pile button the player last clicked -
    // purely a visual cue so PoliticsHand can animate its cards as if being dealt out
    // from that spot. Has no bearing on game state.
    politicsPileOrigin: { x: number; y: number } | undefined = $state(undefined)

    async selectPoliticsPile(pile: 'A' | 'B', origin?: { x: number; y: number }) {
        if (!this.canTakePoliticsCard || this.selectedPoliticsPile) return
        if (origin) this.politicsPileOrigin = origin
        this.viewingMyPoliticsCards = false

        const action = this.createPlayerAction(LookAtPoliticsPile, { pile, revealsInfo: true })

        const candidate = new HydratedLookAtPoliticsPile({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.LookAtPoliticsPile,
            playerId: action.playerId,
            pile,
            revealsInfo: true
        })

        const invalidReason = candidate.invalidLookAtPoliticsPileReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        try {
            await this.applyAction(action)
            this.showPoliticsHand = true
        } catch (e) {
            console.warn('Failed to open politics pile:', e)
            this.errorMessage = 'That pile could not be opened.'
        }
    }

    hidePoliticsHand() {
        this.showPoliticsHand = false
    }

    revealPoliticsHand(origin?: { x: number; y: number }) {
        if (!this.selectedPoliticsPile) return
        if (origin) this.politicsPileOrigin = origin
        this.viewingMyPoliticsCards = false
        this.showPoliticsHand = true
    }

    // Read-only peek at the politics cards a player already holds (as opposed to the
    // draw-pile flow above, which lets the taking player actually pick a new one) -
    // triggered by hovering/clicking your own pile in the player panel. Only ever
    // shows the LOCAL player's own cards (see PlayerState.svelte - other players'
    // panels don't offer this at all, since seeing their cards would defeat the
    // point of them being private).
    viewingMyPoliticsCards: boolean = $state(false)

    get myPoliticsCards(): PoliticsCard[] {
        return this.myPlayer ? this.gameState.getPlayerState(this.myPlayer.id).politicsCards : []
    }

    // DOM anchor for "my politics pile" (the face-down card + count badge in my own
    // player panel row - see PlayerState.svelte) - registered once that panel mounts,
    // so PoliticsHand can compute a live target point for the "deliver the taken
    // card" animation without the two components needing to know each other's
    // internals. Read on demand (not $state) since it's only ever consulted
    // imperatively, mid-animation - it doesn't drive any rendering itself.
    myPanelAnchorEl: HTMLElement | undefined = undefined

    registerMyPanelAnchor(el: HTMLElement) {
        this.myPanelAnchorEl = el
    }

    get myPoliticsPileOrigin(): { x: number; y: number } | undefined {
        if (!this.myPanelAnchorEl) return undefined
        const rect = this.myPanelAnchorEl.getBoundingClientRect()
        return { x: rect.right - 24, y: rect.bottom - 24 }
    }

    showMyPoliticsCards(origin: { x: number; y: number }) {
        this.politicsPileOrigin = origin
        this.showPoliticsHand = false
        this.viewingMyPoliticsCards = true
    }

    hideMyPoliticsCards() {
        this.viewingMyPoliticsCards = false
    }

    async takePoliticsCard(pile: 'A' | 'B', cardId: string) {
        if (!this.canTakePoliticsCard || !this.myPlayer) return

        const action = this.createPlayerAction(TakePoliticsCard, { pile, cardId })

        const candidate = new HydratedTakePoliticsCard({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.TakePoliticsCard,
            playerId: action.playerId,
            pile,
            cardId
        })

        const invalidReason = candidate.invalidTakePoliticsCardReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        this.showPoliticsHand = false
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to take politics card:', e)
            this.errorMessage = 'That pick was rejected.'
        }
    }

    get canPlayRenegadeCard(): boolean {
        if (!this.myPlayer || !this.canChooseAction) return false
        const playerState = this.gameState.getPlayerState(this.myPlayer.id)
        return (
            playerState.knightsInStock > 0 &&
            playerState.politicsCards.some((c) => c.type === PoliticsCardType.Renegade)
        )
    }

    // Which Renegade card is currently being played, and how far through the 4-step
    // targeting flow (own region -> neighboring enemy region -> enemy knight to remove
    // -> own placement square) the player has gotten - purely local UI state, same
    // pattern as selectedExpandRegionId.
    renegadeCardId: string | undefined = $state(undefined)
    renegadeOwnRegionId: string | undefined = $state(undefined)
    renegadeEnemyRegionId: string | undefined = $state(undefined)
    renegadeRemovedSquare: { col: number; row: number } | undefined = $state(undefined)

    get isPlayingRenegadeCard(): boolean {
        return this.renegadeCardId !== undefined
    }

    startPlayingRenegadeCard(cardId: string) {
        if (!this.canPlayRenegadeCard) return
        this.errorMessage = undefined
        this.cancelPlayingAllianceCard()
        this.renegadeCardId = cardId
        this.renegadeOwnRegionId = undefined
        this.renegadeEnemyRegionId = undefined
        this.renegadeRemovedSquare = undefined
    }

    cancelPlayingRenegadeCard() {
        this.renegadeCardId = undefined
        this.renegadeOwnRegionId = undefined
        this.renegadeEnemyRegionId = undefined
        this.renegadeRemovedSquare = undefined
    }

    selectRenegadeOwnRegion(regionId: string) {
        if (!this.renegadeCardId) return
        this.renegadeOwnRegionId = regionId
        this.renegadeEnemyRegionId = undefined
        this.renegadeRemovedSquare = undefined
    }

    // Which of the player's own regions could actually receive the replacement knight
    // - same space/terrain/adjacency/affordability rules as a normal knight placement
    // (ignoring the possible extra removal-side wooded cost, which the final
    // confirmRenegadePlacement validates exactly) - a region with no candidate square
    // at all (full, or its only wooded spot they can't afford) can't be chosen as the
    // starting region in the first place.
    get legalRenegadeOwnRegionIds(): Set<string> {
        if (!this.isPlayingRenegadeCard || !this.myPlayer) return new Set()
        const playerState = this.gameState.getPlayerState(this.myPlayer.id)
        const board = this.gameState.board
        const result = new Set<string>()
        for (const region of this.myRegions) {
            const hasCandidate = region.squareKeys.some((key) => {
                const [col, row] = key.split(',').map(Number)
                const square = getSquare(board, col, row)
                if (!square) return false
                if (square.type !== SquareType.Blank && square.type !== SquareType.Forest) return false
                if (square.knightColor || square.castleColor) return false
                if (square.type === SquareType.Forest && playerState.money < WOODED_KNIGHT_COST) return false
                return neighbors(col, row).some((n) => {
                    if (!isOnBoard(n.col, n.row)) return false
                    if (isWalledBetween(board, col, row, n.col, n.row)) return false
                    const ns = getSquare(board, n.col, n.row)
                    return ns?.knightColor === playerState.color || ns?.castleColor === playerState.color
                })
            })
            if (hasCandidate) result.add(region.id)
        }
        return result
    }

    // Any of another prince's regions bordering the chosen own region - the pair of
    // regions Renegade (like Alliance) acts on. Also requires at least one knight in
    // that region actually safe to remove - a region with none (or only knights whose
    // removal would strand another) can't be targeted at all, so it shouldn't be
    // offered as a choice in the first place.
    get legalRenegadeEnemyRegions(): Region[] {
        const ownRegion = this.gameState.regions.find((r) => r.id === this.renegadeOwnRegionId)
        if (!ownRegion) return []
        return this.gameState.regions.filter(
            (r) =>
                r.ownerColor &&
                r.ownerColor !== ownRegion.ownerColor &&
                regionsAreNeighboring(ownRegion, r) &&
                r.squareKeys.some((key) => {
                    const [col, row] = key.split(',').map(Number)
                    const square = getSquare(this.gameState.board, col, row)
                    return (
                        square?.knightColor === r.ownerColor &&
                        isKnightSafeToRemove(this.gameState, r.ownerColor!, col, row)
                    )
                })
        )
    }

    selectRenegadeEnemyRegion(regionId: string) {
        if (!this.renegadeOwnRegionId) return
        if (!this.legalRenegadeEnemyRegions.some((r) => r.id === regionId)) return
        this.renegadeEnemyRegionId = regionId
        this.renegadeRemovedSquare = undefined
    }

    // Enemy knights in the chosen region that are actually safe to remove - excludes
    // any knight that would strand another one of that color from every castle of
    // that color (removing the last knight of a color is always safe).
    get legalRenegadeRemovableSquares(): { col: number; row: number }[] {
        const enemyRegion = this.gameState.regions.find((r) => r.id === this.renegadeEnemyRegionId)
        if (!enemyRegion?.ownerColor) return []

        const result: { col: number; row: number }[] = []
        for (const key of enemyRegion.squareKeys) {
            const [col, row] = key.split(',').map(Number)
            const square = getSquare(this.gameState.board, col, row)
            if (
                square?.knightColor === enemyRegion.ownerColor &&
                isKnightSafeToRemove(this.gameState, enemyRegion.ownerColor, col, row)
            ) {
                result.push({ col, row })
            }
        }
        return result
    }

    selectRenegadeRemovedSquare(col: number, row: number) {
        if (!this.legalRenegadeRemovableSquares.some((s) => s.col === col && s.row === row)) return
        this.renegadeRemovedSquare = { col, row }
    }

    private isValidRenegadeAttempt(placedCol: number, placedRow: number): boolean {
        if (
            !this.myPlayer ||
            !this.renegadeCardId ||
            !this.renegadeOwnRegionId ||
            !this.renegadeEnemyRegionId ||
            !this.renegadeRemovedSquare
        ) {
            return false
        }
        const candidate = new HydratedPlayRenegadeCard({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlayRenegadeCard,
            playerId: this.myPlayer.id,
            cardId: this.renegadeCardId,
            ownRegionId: this.renegadeOwnRegionId,
            enemyRegionId: this.renegadeEnemyRegionId,
            removedCol: this.renegadeRemovedSquare.col,
            removedRow: this.renegadeRemovedSquare.row,
            placedCol,
            placedRow
        })
        return candidate.isValidPlayRenegadeCard(this.gameState)
    }

    // Squares in the player's own region that would legally receive the replacement
    // knight, given everything picked so far - computed once per access, same pattern
    // as legalNextExpansionSquares.
    get legalRenegadePlacementSquares(): { col: number; row: number }[] {
        if (!this.renegadeOwnRegionId || !this.renegadeEnemyRegionId || !this.renegadeRemovedSquare) return []

        const result: { col: number; row: number }[] = []
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (this.isValidRenegadeAttempt(col, row)) result.push({ col, row })
            }
        }
        return result
    }

    async confirmRenegadePlacement(placedCol: number, placedRow: number) {
        const { myPlayer, renegadeCardId, renegadeOwnRegionId, renegadeEnemyRegionId, renegadeRemovedSquare } = this
        if (!myPlayer || !renegadeCardId || !renegadeOwnRegionId || !renegadeEnemyRegionId || !renegadeRemovedSquare) {
            return
        }

        const action = this.createPlayerAction(PlayRenegadeCard, {
            cardId: renegadeCardId,
            ownRegionId: renegadeOwnRegionId,
            enemyRegionId: renegadeEnemyRegionId,
            removedCol: renegadeRemovedSquare.col,
            removedRow: renegadeRemovedSquare.row,
            placedCol,
            placedRow
        })

        if (!this.isValidRenegadeAttempt(placedCol, placedRow)) {
            const candidate = new HydratedPlayRenegadeCard({
                id: 'candidate',
                gameId: this.gameState.gameId,
                source: ActionSource.User,
                type: ActionType.PlayRenegadeCard,
                playerId: myPlayer.id,
                cardId: renegadeCardId,
                ownRegionId: renegadeOwnRegionId,
                enemyRegionId: renegadeEnemyRegionId,
                removedCol: renegadeRemovedSquare.col,
                removedRow: renegadeRemovedSquare.row,
                placedCol,
                placedRow
            })
            this.errorMessage = candidate.invalidPlayRenegadeCardReason(this.gameState)
            this.cancelPlayingRenegadeCard()
            return
        }

        this.errorMessage = undefined
        this.cancelPlayingRenegadeCard()
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to play Renegade card:', e)
            this.errorMessage = 'That play was rejected.'
        }
    }

    get canPlayAllianceCard(): boolean {
        if (!this.myPlayer || !this.canChooseAction) return false
        const playerState = this.gameState.getPlayerState(this.myPlayer.id)
        return playerState.politicsCards.some((c) => c.type === PoliticsCardType.Alliance)
    }

    // Which Alliance card is currently being played, and whether the player has
    // picked their own region yet - a 2-step targeting flow (own region -> a
    // neighboring enemy region, which immediately confirms), same overall pattern as
    // the Renegade flow but shorter.
    allianceCardId: string | undefined = $state(undefined)
    allianceOwnRegionId: string | undefined = $state(undefined)

    get isPlayingAllianceCard(): boolean {
        return this.allianceCardId !== undefined
    }

    startPlayingAllianceCard(cardId: string) {
        if (!this.canPlayAllianceCard) return
        this.errorMessage = undefined
        this.cancelPlayingRenegadeCard()
        this.allianceCardId = cardId
        this.allianceOwnRegionId = undefined
    }

    cancelPlayingAllianceCard() {
        this.allianceCardId = undefined
        this.allianceOwnRegionId = undefined
    }

    selectAllianceOwnRegion(regionId: string) {
        if (!this.allianceCardId) return
        this.allianceOwnRegionId = regionId
    }

    // Any of another prince's regions bordering the chosen own region that isn't
    // already allied with it.
    get legalAllianceEnemyRegions(): Region[] {
        const ownRegion = this.gameState.regions.find((r) => r.id === this.allianceOwnRegionId)
        if (!ownRegion) return []
        return this.gameState.regions.filter(
            (r) =>
                r.ownerColor &&
                r.ownerColor !== ownRegion.ownerColor &&
                regionsAreNeighboring(ownRegion, r) &&
                !areRegionsAllied(this.gameState.alliances, ownRegion.id, r.id)
        )
    }

    // Picking the enemy region immediately confirms the play - there's no further
    // step (no board squares to choose), unlike Renegade.
    async selectAllianceEnemyRegion(regionId: string) {
        const { myPlayer, allianceCardId, allianceOwnRegionId } = this
        if (!myPlayer || !allianceCardId || !allianceOwnRegionId) return
        if (!this.legalAllianceEnemyRegions.some((r) => r.id === regionId)) return

        const action = this.createPlayerAction(PlayAllianceCard, {
            cardId: allianceCardId,
            ownRegionId: allianceOwnRegionId,
            enemyRegionId: regionId
        })

        const candidate = new HydratedPlayAllianceCard({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.PlayAllianceCard,
            playerId: myPlayer.id,
            cardId: allianceCardId,
            ownRegionId: allianceOwnRegionId,
            enemyRegionId: regionId
        })

        const invalidReason = candidate.invalidPlayAllianceCardReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            this.cancelPlayingAllianceCard()
            return
        }

        this.errorMessage = undefined
        this.cancelPlayingAllianceCard()
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to play Alliance card:', e)
            this.errorMessage = 'That play was rejected.'
        }
    }

    // Every existing alliance the current player is a participant in and could afford
    // to cancel right now (still requires it being their own decision-laying turn -
    // enforced by the engine's own validity check, not re-derived here).
    get myCancellableAlliances(): { id: string; otherColor: Color }[] {
        if (!this.myPlayer || !this.canChooseAction) return []
        const myColor = this.gameState.getPlayerState(this.myPlayer.id).color
        if (this.gameState.getPlayerState(this.myPlayer.id).money < ALLIANCE_CANCELLATION_COST) return []

        const result: { id: string; otherColor: Color }[] = []
        for (const alliance of this.gameState.alliances) {
            const regionA = this.gameState.regions.find((r) => r.id === alliance.regionAId)
            const regionB = this.gameState.regions.find((r) => r.id === alliance.regionBId)
            if (regionA?.ownerColor === myColor && regionB?.ownerColor) {
                result.push({ id: alliance.id, otherColor: regionB.ownerColor })
            } else if (regionB?.ownerColor === myColor && regionA?.ownerColor) {
                result.push({ id: alliance.id, otherColor: regionA.ownerColor })
            }
        }
        return result
    }

    async cancelAlliance(allianceId: string) {
        if (!this.myPlayer) return

        const action = this.createPlayerAction(CancelAlliance, { allianceId })

        const candidate = new HydratedCancelAlliance({
            id: 'candidate',
            gameId: this.gameState.gameId,
            source: ActionSource.User,
            type: ActionType.CancelAlliance,
            playerId: this.myPlayer.id,
            allianceId
        })

        const invalidReason = candidate.invalidCancelAllianceReason(this.gameState)
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        try {
            await this.applyAction(action)
        } catch (e) {
            console.warn('Failed to cancel alliance:', e)
            this.errorMessage = 'That cancellation was rejected.'
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
            if (this.gameState.machineState === MachineState.TakingPoliticsCard) return
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

            if (this.isNegotiator && this.myPlayer) {
                // Both negotiators are active for the whole negotiation, but hotseat's
                // myPlayer only ever resolves to one of them (activePlayers.at(0)) - so
                // from here we can propose and sign for ourselves, but can never supply
                // the OTHER negotiator's signature. Stop rather than spin forever;
                // completing a negotiation end-to-end needs a second session/tab (or an
                // engine-level test) acting as the other player.
                if (this.canSignNegotiationOffer) {
                    await this.signNegotiationOffer()
                } else if (!this.gameState.negotiation?.offer) {
                    const myMoney = this.gameState.getPlayerState(this.myPlayer.id).money
                    await this.proposeNegotiationOffer(this.myPlayer.id, Math.min(1, myMoney))
                }
                break
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
