import { ActionSource, createAction, type Color } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import { nanoid } from 'nanoid'
import {
    ActionCardType,
    ActionType,
    ALLIANCE_CANCELLATION_COST,
    areRegionsAllied,
    BOARD_COLS,
    BOARD_ROWS,
    CancelAlliance,
    CardBack,
    buildDecisionPlan,
    ChooseAction,
    countKnights,
    currentPlacementColor,
    detectNewRegions,
    DrawActionCard,
    expandRegionReason,
    ExpandRegion,
    isExpandRegion,
    takePoliticsCardReason,
    playRenegadeCardReason,
    playAllianceCardReason,
    placeKnightReason,
    placeCastleIsValid,
    negotiationProposalIsValid,
    lookAtPoliticsPileReason,
    duelBidIsValid,
    cancelAllianceReason,
    legalExpansionSquares,
    legalKnightSquares,
    legalWallEdges,
    getSquare,
    HydratedCancelAlliance,
    HydratedChooseAction,
    HydratedDrawActionCard,
    HydratedLowenherzGameState,
    HydratedLowenherzPlayerState,
    HydratedPlaceCastle,
    isAdvanceResolution,
    isDrawActionCard,
    isKnightSafeToRemove,
    isOnBoard,
    isWalledBetween,
    LookAtPoliticsPile,
    LowenherzGameState,
    MachineState,
    manhattanDistance,
    type Negotiation,
    NegotiationMove,
    NegotiationMoveKind,
    neighbors,
    Pass,
    PlaceCastle,
    PlaceKnight,
    PlaceWall,
    placeWallReason,
    PlayAllianceCard,
    PlayRenegadeCard,
    type PoliticsCard,
    PoliticsCardType,
    Region,
    regionsAreNeighboring,
    rotateToStart,
    removeInteriorWalls,
    scoreRegion,
    squareKey,
    SquareType,
    SubmitDuelBid,
    TakePoliticsCard,
    wallBetween,
    WOODED_KNIGHT_COST
} from '@tabletop/lowenherz'

// What the winner of a knight action is spending the sword IN HAND on. One sword buys one of
// these, so a two-sword action asks twice rather than asking once for a shape.
//
// It used to name whole shapes - twoKnights, knightThenExpand, expandThenKnight - declared up
// front. Asking per sword says the same thing in smaller pieces: the second question simply omits
// 'expand' once an expansion has been used, which is the rulebook's "using this action to expand
// twice is not allowed" falling out of the options rather than being encoded in the shapes.
export type KnightPlan = 'knight' | 'expand'

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

    // Draft state for the negotiation and duel panels: what the player has typed in but not yet
    // submitted, plus the brief hold on a finished negotiation so both signatures can be seen.
    //
    // Session-owned rather than component-owned because two components need it. The panels that
    // render these controls are moving out of the board's scaled subtree - instructions should not
    // grow and shrink with the map - while the board's own click handlers still read and write the
    // same drafts. One of the two had to be the owner, and neither component is a parent of the
    // other, so it is this.
    //
    // The EFFECTS that maintain these stay in whichever component renders the panel: $effect needs
    // an owner and a session class is not one. What lives here is the value, not the syncing.
    frozenNegotiation: Negotiation | undefined = $state(undefined)

    // What the negotiation panel shows: the live negotiation, or the fully-signed one being held
    // on screen for a beat after it resolves.
    get displayNegotiation(): Negotiation | undefined {
        return this.gameState.negotiation ?? this.frozenNegotiation
    }

    // The draft terms. Derived from the standing offer, with the player's edits stored against the
    // negotiation-and-offer they were made for - so a new offer, or a new negotiation, reads as the
    // offer says rather than keeping whatever was typed against the old one.
    //
    // An effect used to assign these from the offer on every tick and clear them when the
    // negotiation ended. Deriving them means there is nothing to clear: no negotiation, no draft.
    private negotiationDraft:
        | { key: string; proposerId: string | undefined; amount: number }
        | undefined = $state(undefined)

    private get negotiationKey(): string | undefined {
        const negotiation = this.displayNegotiation
        if (!negotiation) return undefined
        const offer = negotiation.offer
        return `${negotiation.slot}:${negotiation.playerIds.join(',')}:${
            offer ? `${offer.fromPlayerId}:${offer.amount}` : 'none'
        }`
    }

    get negotiationProposerId(): string | undefined {
        const key = this.negotiationKey
        if (!key) return undefined
        if (this.negotiationDraft?.key === key) return this.negotiationDraft.proposerId

        const negotiation = this.displayNegotiation!
        if (negotiation.offer) return negotiation.offer.fromPlayerId
        // No offer yet: default to me if I am in it, otherwise the first participant.
        const myId = this.myPlayer?.id
        return myId && negotiation.playerIds.includes(myId) ? myId : negotiation.playerIds[0]
    }

    get negotiationAmount(): number {
        const key = this.negotiationKey
        if (!key) return 0
        if (this.negotiationDraft?.key === key) return this.negotiationDraft.amount
        return this.displayNegotiation?.offer?.amount ?? 1
    }

    setNegotiationProposer(proposerId: string) {
        const key = this.negotiationKey
        if (!key) return
        this.negotiationDraft = { key, proposerId, amount: this.negotiationAmount }
    }

    setNegotiationAmount(amount: number) {
        const key = this.negotiationKey
        if (!key) return
        this.negotiationDraft = { key, proposerId: this.negotiationProposerId, amount }
    }

    // Holds a resolved negotiation on screen for a beat. Called from the per-action listener when
    // the closing signature lands, since that action carries the executed offer - an effect had to
    // notice the negotiation vanish and remember what it had been.
    private negotiationFreezeTimer: ReturnType<typeof setTimeout> | undefined
    freezeNegotiation(negotiation: Negotiation, holdMs: number) {
        if (this.negotiationFreezeTimer) clearTimeout(this.negotiationFreezeTimer)
        this.frozenNegotiation = negotiation
        this.negotiationFreezeTimer = setTimeout(() => {
            this.frozenNegotiation = undefined
            this.negotiationFreezeTimer = undefined
        }, holdMs)
    }

    // Per-player draft bids. A duel bid is a one-shot commitment per player, unlike negotiation's
    // single shared offer, so each duelist gets their own.
    // Keyed to the duel they were entered for. A re-duel replaces gameState.duel outright, never
    // passing through undefined, so an effect had to keep a signature of its own to notice the
    // change and zero the bids; keying them means a new duel reads as no bids at all.
    private duelBids: { signature: string; amounts: Record<string, number> } | undefined =
        $state(undefined)
    private duelTestBidder: { signature: string; playerId: string } | undefined = $state(undefined)

    // The duel being bid in: its slot, its players, and how many ties it has been through. Any of
    // those changing is a different duel.
    private get duelSignature(): string | undefined {
        const duel = this.gameState.duel
        if (!duel) return undefined
        return `${duel.slot}:${duel.playerIds.join(',')}:${duel.tieCount}`
    }

    get duelBidAmounts(): Record<string, number> {
        const signature = this.duelSignature
        if (!signature || this.duelBids?.signature !== signature) return {}
        return this.duelBids.amounts
    }

    setDuelBidAmount(playerId: string, amount: number) {
        const signature = this.duelSignature
        if (!signature) return
        const amounts =
            this.duelBids?.signature === signature ? { ...this.duelBids.amounts } : {}
        amounts[playerId] = amount
        this.duelBids = { signature, amounts }
    }

    get testBiddingForPlayerId(): string | undefined {
        const signature = this.duelSignature
        if (!signature || this.duelTestBidder?.signature !== signature) return undefined
        return this.duelTestBidder.playerId
    }

    setTestBiddingForPlayerId(playerId: string | undefined) {
        const signature = this.duelSignature
        if (!signature) return
        this.duelTestBidder = playerId === undefined ? undefined : { signature, playerId }
    }

    get canPlaceCastle(): boolean {
        if (!this.myPlayer) return false
        return HydratedPlaceCastle.canPlaceCastle(this.gameState, this.myPlayer.id)
    }

    get setupComplete(): boolean {
        return this.gameState.machineState !== MachineState.PlacingCastles
    }

    // The color the next setup placement will actually be - the placing player's own for
    // the opening laps, the shared neutral color for the closing ones (2 castles each at 2
    // players, 1 each at 3). Every setup preview uses this rather than the player's own
    // color, so the ghost castle/knight matches the piece that's really about to land.
    get placementColor(): Color | undefined {
        if (this.setupComplete) return undefined
        return currentPlacementColor(this.gameState)
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
                noKnightSquare:
                    "That spot isn't allowed for a castle — there's nowhere beside it to put its knight.",
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
        if (
            !placeCastleIsValid(
                this.gameState,
                action.playerId,
                castleSquare.col,
                castleSquare.row,
                knightCol,
                knightRow
            )
        ) {
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

    // A Silver Mine sitting on the discard pile means it was just revealed and is
    // waiting for the active player to manually draw the next card (see startOfTurn.ts).
    // Its per-player hill scoring lives on the DrawActionCard action that drew it - the
    // most recent draw, since nothing's been drawn since. Returns undefined once a later
    // card is drawn (that draw becomes the most recent one). Lives here rather than in
    // RealBoard because the board announces the reveal while the action bar shows each
    // player's payout under their points (see ActionToolbar).
    // One marker per alliance, carrying the walls along the shared border it was struck across.
    // The board draws hearts on those walls and bursts them when the alliance breaks; the status
    // panel names the alliance - so both halves need this, and neither owns it.
    //
    // Alliances with no shared border are filtered out: an alliance whose regions no longer touch
    // has nothing to draw and nothing to say.
    get allianceMarkers(): {
        id: string
        walls: { col: number; row: number; edge: string }[]
        cancellable: boolean
        otherColor: Color | undefined
    }[] {
        const alliances = this.gameState.alliances
        if (alliances.length === 0) return []

        const regions = this.gameState.regions
        const cancellable = new Map(this.myCancellableAlliances.map((a) => [a.id, a.otherColor]))

        return alliances
            .map((alliance) => {
                const regionA = regions.find((r) => r.id === alliance.regionAId)
                const regionB = regions.find((r) => r.id === alliance.regionBId)
                const walls =
                    !regionA || !regionB
                        ? []
                        : this.gameState.board.walls.filter((wall) => {
                              const keyHere = squareKey(wall.col, wall.row)
                              const keyThere =
                                  wall.edge === 'north'
                                      ? squareKey(wall.col, wall.row - 1)
                                      : squareKey(wall.col - 1, wall.row)
                              return (
                                  (regionA.squareKeys.includes(keyHere) &&
                                      regionB.squareKeys.includes(keyThere)) ||
                                  (regionB.squareKeys.includes(keyHere) &&
                                      regionA.squareKeys.includes(keyThere))
                              )
                          })
                return {
                    id: alliance.id,
                    walls,
                    // Cancellable means the rulebook's "one of the two players participating in it
                    // pays ten ducats" is genuinely open to ME right now - myCancellableAlliances
                    // already checks both the participation and the 10 ducats.
                    cancellable: cancellable.has(alliance.id),
                    otherColor: cancellable.get(alliance.id)
                }
            })
            .filter((marker) => marker.walls.length > 0)
    }

    // What the sword in hand can be spent on, right now. Asked once per sword, so a two-sword
    // action reaches this twice and the second visit is narrower: canStartExpansion is already
    // false once an expansion has been used, which is how "expand twice is not allowed" removes
    // itself from the second question.
    //
    // canStartExpansion rather than canExpandRegion: the latter is true whenever you own a region
    // at all, even if every one of them is boxed in, which is how "expand a region" used to be
    // offered and then dead-end once a region was picked.
    get availableKnightPlans(): KnightPlan[] {
        if (!this.canPlaceKnight) return []

        // Nothing else is offered while an expansion is open. Its second space is free and the
        // board shows only expansion squares, so asking what to do with the next sword here would
        // put knight dots on the map at the one moment a knight cannot be placed.
        if (this.canContinueExpansion) return []

        const plans: KnightPlan[] = []
        if (this.canPlaceAnotherKnight) plans.push('knight')
        if (this.canStartFreshExpansion) plans.push('expand')
        return plans
    }


    // How many swords this knight action started with, for wording it. Read off the band of the
    // slot being resolved - resolvedSlots is pushed before the placement phase, so its length IS
    // that slot's number - rather than off knightsRemaining, which counts down as the action is
    // spent and would relabel a two-sword action as a one-sword one halfway through.
    //
    // The band has to come from the slot rather than from "whichever band is a knight band":
    // several cards carry knight bands in BOTH the middle and bottom slots, with different counts.
    get knightActionSwords(): number {
        const card = this.gameState.currentActionCard
        if (card?.type !== ActionCardType.Standard) return 0

        const slot = this.gameState.resolvedSlots.length
        const band = slot === 2 ? card.middle : slot === 3 ? card.bottom : undefined
        return band?.kind === 'knight' ? band.count : 0
    }

    // Whether a board click right now means "expand into this space" / "place a knight here".
    // Both can be live at once: after an expansion's first space, its optional second space is
    // still clickable while the leftover sword is being spent on a knight, and clicking the knight
    // square is what ends the expansion at one space (there is no Done button).
    //
    // Each is gated on the step's sword not being spent yet, which is what makes a two-sword action
    // ask twice instead of running straight through.
    get expandStageActive(): boolean {
        // An expansion already under way stays clickable whatever the current step is: its second
        // space was paid for by the sword that started it, so it costs nothing and belongs to no
        // step.
        //
        // canContinueExpansion rather than the raw expandingRegionId, because the engine keeps
        // that id set until the second space is taken or the action ends - it has no notion of the
        // player declining. Reading it directly left the expansion live after a decline, so the
        // board went on offering expansion squares and the prompt asked for a first space again.
        if (this.canContinueExpansion) return true

        return this.knightPlan === 'expand' && this.canExpandRegion
    }

    // The region being expanded turned out to have nowhere legal to grow into. Its sword is better
    // spent on a knight than forfeited, so this hands the knight half the board even under an
    // expansion-first choice - and there is no overlap to disambiguate, since there are no legal
    // expansion squares left to compete with.
    get expansionDeadEnd(): boolean {
        return (
            this.expandStageActive &&
            this.selectedExpandRegionId !== undefined &&
            this.expansionSquares.length === 0 &&
            this.legalNextExpansionSquares.length === 0
        )
    }

    get knightStageActive(): boolean {
        return this.knightPlan === 'knight' && this.canPlaceAnotherKnight
    }

    // Public rather than private: the narration deriveds that use these are being moved out of
    // RealBoard in stages, and until the last of them lands here they are called from components.
    //
    // roundAdvanced marks the END of a round, so scanning backward from "now" always hits it
    // BEFORE anything else that happened earlier in the very round we are trying to inspect -
    // money bag payouts, a completed negotiation, duel bids. Stopping on the first one would mean
    // never finding anything, even when it is squarely within the round the message describes. The
    // first roundAdvanced just closes out that round; only a SECOND confirms we have scanned past
    // it entirely into the round before.
    isPastCurrentRound(roundBoundariesSeen: number): boolean {
        return roundBoundariesSeen >= 2
    }

    // A slot's resolution is stale - superseded, no longer the single most recent notable thing -
    // once a later slot has resolved since it. resolvedSlots grows by exactly one, in order, every
    // time ANY slot fully resolves, so a slot's own number matching the current length means
    // nothing has resolved more recently than it.
    isFreshestResolvedSlot(slot: number | undefined): boolean {
        return slot !== undefined && slot === this.gameState.resolvedSlots.length
    }

    // What a slot's band is called, for the sentences that describe winning it.
    actionNounForSlot(slot: 1 | 2 | 3): string {
        const card = this.gameState.currentActionCard
        if (!card || card.type !== 'standard') return ''
        const band = slot === 1 ? card.top : slot === 2 ? card.middle : card.bottom
        if (band.kind === 'border') return 'walls'
        if (band.kind === 'knight') return 'knights'
        if (band.kind === 'politics') return 'politics'
        return ''
    }

    playerIdForColor(color: Color): string | undefined {
        return this.gameState.players.find((p) => p.color === color)?.playerId
    }


    get lastMineHillScoring(): { playerId: string; points: number }[] | undefined {
        const discarded = this.gameState.discardedActionCard
        if (discarded?.type !== ActionCardType.Mining) return undefined
        const actions = this.actions
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) {
                return action.metadata?.cardType === ActionCardType.Mining
                    ? (action.metadata.hillScoring ?? [])
                    : undefined
            }
        }
        return undefined
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

        // Auto-placing is a testing shortcut past the deliberate variable-construction
        // setup, so also discard the A-lettered cards (which only exist to be shuffled
        // on top for that setup) - play then begins from the B deck, exactly like the
        // rulebook's basic game. A no-op in standard-setup games, whose deck never had
        // A cards to begin with.
        if (this.gameState.actionDeck.some((c) => c.back === CardBack.A)) {
            this.gameState.actionDeck = this.gameState.actionDeck.filter((c) => c.back !== CardBack.A)
            await this.setGameState(this.gameState.dehydrate())
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

    // Gives every player a random 1-5 politics cards (any mix of types, with a
    // plausible value for Parchment/Treasure) - for testing the hand-splay UI with
    // varied, realistic-looking counts across every seat at once, without grinding
    // through Crown and Scepter draws to build them up naturally. Each click REPLACES
    // whatever every player was holding rather than adding to it, so clicking
    // repeatedly re-rolls the counts through the 1-5 range (appending would run hands
    // straight past 5 after a click or two, which is exactly the range worth eyeing).
    async giveTestRandomPoliticsCards() {
        const valuesByType: Record<PoliticsCardType, number[] | undefined> = {
            [PoliticsCardType.Alliance]: undefined,
            [PoliticsCardType.Renegade]: undefined,
            [PoliticsCardType.Parchment]: [3, 4, 5],
            [PoliticsCardType.Treasure]: [8, 10, 12, 15]
        }
        const types = Object.values(PoliticsCardType)

        for (const playerState of this.gameState.players) {
            const count = 1 + Math.floor(Math.random() * 5)
            const newCards: PoliticsCard[] = Array.from({ length: count }, () => {
                const type = types[Math.floor(Math.random() * types.length)]
                const values = valuesByType[type]
                const value = values ? values[Math.floor(Math.random() * values.length)] : undefined
                return {
                    id: `test-${type}-${Math.random().toString(36).slice(2)}`,
                    type,
                    ...(value !== undefined ? { value } : {})
                }
            })
            playerState.politicsCards = newCards
        }

        await this.setGameState(this.gameState.dehydrate())
    }

    get canDrawActionCard(): boolean {
        if (!this.myPlayer) return false
        return HydratedDrawActionCard.canDrawActionCard(this.gameState, this.myPlayer.id)
    }

    async drawActionCard() {
        if (!this.canDrawActionCard) return

        const action = this.createPlayerAction(DrawActionCard, { revealsInfo: true })
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

    // Which slots this player has already laid a decision card on this round. A player
    // owns exactly one card of each number (1/2/3), so these can never be picked again -
    // and when they get two placements (the first player below 4 players), the second has
    // to go somewhere new. Clicking one of these used to dispatch an action the engine
    // rejects outright, which surfaced as an error page rather than a dead click.
    get mySlotsChosenThisRound(): (1 | 2 | 3)[] {
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) return []
        return this.gameState.decisions.filter((d) => d.playerId === myPlayerId).map((d) => d.slot)
    }

    canChooseSlot(slot: 1 | 2 | 3): boolean {
        return this.canChooseAction && !this.mySlotsChosenThisRound.includes(slot)
    }

    // How many decision cards this player lays this round versus how many they've laid so
    // far - "the first player always lays 2 decision cards" below 4 players (see
    // buildDecisionPlan), which is worth saying out loud rather than leaving them to
    // wonder why their turn didn't end.
    get myDecisionsThisRound(): { laid: number; total: number } {
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) return { laid: 0, total: 0 }
        const plan = buildDecisionPlan(
            rotateToStart(this.gameState.turnOrder, this.gameState.firstPlayerId)
        )
        return {
            laid: this.mySlotsChosenThisRound.length,
            total: plan.filter((playerId) => playerId === myPlayerId).length
        }
    }

    async chooseAction(slot: 1 | 2 | 3) {
        // Belt and braces alongside canChooseSlot gating the click itself: a slot already
        // spent this round is simply ignored, never dispatched.
        if (!this.canChooseSlot(slot)) return

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
    // Returns whether the offer actually became the standing one. Callers keep local draft
    // state (who pays, how much) that has to be rolled back when it didn't - otherwise the
    // panel goes on displaying an offer nobody submitted, and Signed then signs whatever the
    // real standing offer is, which can be the opposite payment direction.
    async proposeNegotiationOffer(fromPlayerId: string, amount: number): Promise<boolean> {
        if (!this.myPlayer || !this.isNegotiator) return false

        if (!negotiationProposalIsValid(this.gameState, this.myPlayer.id, fromPlayerId, amount)) {
            this.errorMessage =
                "That offer isn't allowed — it must be a whole number of ducats the payer can afford."
            return false
        }

        const action = this.createPlayerAction(NegotiationMove, {
            kind: NegotiationMoveKind.Propose,
            fromPlayerId,
            amount
        })
        this.errorMessage = undefined
        try {
            await this.applyAction(action)
            return true
        } catch (e) {
            console.warn('Failed to propose negotiation offer:', e)
            this.errorMessage = 'That offer was rejected.'
            return false
        }
    }

    get canSignNegotiationOffer(): boolean {
        if (!this.isNegotiator) return false
        // A Sign with no standing offer is rejected by the engine
        // (NegotiationMove.invalidNegotiationMoveReason), so signing has to be paired with a
        // proposal that actually succeeded - see RealBoard's signNegotiation, which stops if
        // its proposal is refused rather than dispatching a Sign that can't land.
        // Doesn't require an offer to already exist - see RealBoard.svelte's Signed
        // button, which proposes the current draft first if nothing's been proposed
        // yet, then signs it, so the button is usable immediately without a
        // separate action having to be auto-submitted the moment negotiation starts
        // (that used to block Undo - the auto-proposal itself was always the
        // nearest undoable action, hiding whatever came before the negotiation).
        return !this.hasSignedNegotiationOffer
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

        if (!duelBidIsValid(this.gameState, this.myPlayer.id, amount, treasureCardId)) {
            this.errorMessage = "That bid isn't allowed — it must be a whole number of ducats you can afford, backed by a Treasure card you actually hold (if any)."
            return
        }

        const action = this.createPlayerAction(SubmitDuelBid, {
            amount,
            ...(treasureCardId ? { treasureCardId } : {})
        })
        this.errorMessage = undefined
        this.armedTreasure = undefined
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
        return placeWallReason(this.gameState, this.myPlayer.id, col1, row1, col2, row2) === undefined
    }

    // Every currently-legal wall position, as the pair of squares it separates - one
    // entry per edge (not per square), so the board can render a single clickable line
    // directly on the boundary rather than requiring a two-click square-then-square
    // flow. Computed once per access (not re-entered per edge), matching the
    // legalCastleSquares pattern.
    get legalWallEdges(): { col1: number; row1: number; col2: number; row2: number }[] {
        if (!this.canPlaceWall) return []
        if (!this.myPlayer) return []
        return legalWallEdges(this.gameState, this.myPlayer.id)
    }

    async placeWallBetween(col1: number, row1: number, col2: number, row2: number) {
        if (!this.canPlaceWall) return

        const action = this.createPlayerAction(PlaceWall, { col1, row1, col2, row2 })

        const invalidReason = placeWallReason(this.gameState, action.playerId, col1, row1, col2, row2)
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
    // The armed card, recorded with the duel it was armed during - or with no duel, since a
    // Treasure is also armed to pay for a wooded knight placement.
    //
    // Keeping the duel alongside it is what stops an armed card riding into a RE-duel: the
    // signature changes, the record stops matching, and it reads as unarmed. An effect used to
    // notice the new duel and unarm it.
    private armedTreasure: { cardId: string; duelSignature: string | undefined } | undefined =
        $state(undefined)

    private get selectedTreasureCardId(): string | undefined {
        const armed = this.armedTreasure
        if (!armed) return undefined
        // Armed outside a duel survives one starting; armed DURING a duel dies with it.
        if (armed.duelSignature !== undefined && armed.duelSignature !== this.duelSignature) {
            return undefined
        }
        return armed.cardId
    }

    selectTreasureCard(cardId: string | undefined) {
        this.armedTreasure =
            cardId === undefined ? undefined : { cardId, duelSignature: this.duelSignature }
    }

    // The armed card itself, but only while arming it still means anything: it has to be
    // genuinely in hand (not already spent, not left over from an earlier turn) AND there
    // has to be a live window to spend it in - a wooded knight placement or a duel bid.
    // Without that second condition an arming from one turn stayed live indefinitely, and
    // the next wooded knight placement silently paid with the card instead of ducats, with
    // nothing on screen to say a card was armed at all.
    get selectedTreasureCard(): PoliticsCard | undefined {
        if (!this.selectedTreasureCardId) return undefined
        if (!this.canPlaceKnight && !this.canSubmitDuelBid) return undefined
        return this.myTreasureCards.find((c) => c.id === this.selectedTreasureCardId)
    }

    // Deliberately routed through selectedTreasureCard rather than the raw id, so a stale
    // arming can never be attached to a placement.
    private treasureCardIdFor(col: number, row: number): string | undefined {
        const square = getSquare(this.gameState.board, col, row)
        return square?.type === SquareType.Forest ? this.selectedTreasureCard?.id : undefined
    }

    // Every square the current player could legally place a knight on right now -
    // highlighted before it's clicked, same pattern as legalCastleSquares.
    get legalKnightSquares(): { col: number; row: number }[] {
        if (!this.myPlayer || !this.canPlaceKnight) return []
        return legalKnightSquares(this.gameState, this.myPlayer.id, (col, row) =>
            this.treasureCardIdFor(col, row)
        )
    }

    async placeKnight(col: number, row: number) {
        if (!this.canPlaceKnight || !this.myPlayer) return

        const treasureCardId = this.treasureCardIdFor(col, row)
        const action = this.createPlayerAction(PlaceKnight, {
            col,
            row,
            ...(treasureCardId ? { treasureCardId } : {})
        })

        const invalidReason = placeKnightReason(
            this.gameState,
            action.playerId,
            col,
            row,
            treasureCardId
        )
        if (invalidReason) {
            this.errorMessage = invalidReason
            return
        }

        this.errorMessage = undefined
        this.armedTreasure = undefined
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
        // Declining the rest of the action also disarms any Treasure card armed for it -
        // belt and braces alongside selectedTreasureCard's window check, so the local
        // selection doesn't outlive the thing it was armed for.
        this.armedTreasure = undefined

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

    // The regions a board click could legitimately pick to expand right now. Normally
    // any of your own, but an expansion already under way pins the choice to ITS region:
    // the engine only allows a 2nd space of that same region ("You're already expanding a
    // different region this turn"), so offering the others led to picking one whose every
    // square was then rejected - which surfaced as the region having "nowhere legal to
    // expand into", the one dead end that isn't about the board at all. That's reachable
    // whenever the local pick is dropped while the engine's expansion stays open (an Undo,
    // or the expand stage briefly closing - see RealBoard's cancelExpansion effect).
    // Regions with nowhere legal to go are excluded outright, rather than being offered
    // and then rejected on the next click. That dead end was the ONLY way to reach the
    // "this region has nowhere legal to expand into" message, so pruning here means a
    // player can no longer walk into it: every region still on offer has a legal target.
    get expandableRegions(): Region[] {
        const inProgressId = this.gameState.expandingRegionId
        if (inProgressId) return this.myRegions.filter((r) => r.id === inProgressId)
        if (!this.myPlayer) return []
        const playerId = this.myPlayer.id
        return this.myRegions.filter(
            (region) => legalExpansionSquares(this.gameState, playerId, region.id).length > 0
        )
    }

    get canExpandRegion(): boolean {
        if (!this.canPlaceKnight || this.myRegions.length === 0) return false
        // "Using this action to expand twice is not allowed" - once this action's
        // expansion is spent, only its leftover sword's knight is left. An expansion
        // still in progress (its optional 2nd space) doesn't count as a second one, so
        // the expand UI has to stay up for that - but only while the player still wants
        // it, hence canContinueExpansion rather than the raw engine flag, which stays set
        // through a decline.
        return !this.gameState.expansionUsed || this.canContinueExpansion
    }

    // Whether placing a knight is genuinely still on the table - distinct from
    // canPlaceKnight, which only says it's your knight action. A player can win the
    // action with an empty knight stock (and spend it expanding instead), or have a
    // sword left with nowhere legal to put a knight.
    get canPlaceAnotherKnight(): boolean {
        return this.canPlaceKnight && this.legalKnightSquares.length > 0
    }

    // Whether STARTING an expansion is a real option - the same question
    // canPlaceAnotherKnight asks of knights. canExpandRegion only establishes that the
    // action allows an expansion and that I own a region at all; it says nothing about
    // whether any of them can actually move, which is what let a boxed-in player choose
    // "expand a region" and only then discover there was nowhere to go.
    // Deliberately separate from canExpandRegion, which also governs an expansion already
    // under way: once the first space is down the expand UI has to stay up to offer the
    // optional second one, even when no second space is legal - that case ends the
    // expansion, it doesn't invalidate the choice already made.
    get canStartExpansion(): boolean {
        if (!this.canExpandRegion) return false
        if (this.gameState.expandingRegionId !== undefined) return true
        // expandableRegions is already filtered to regions with a legal target.
        return this.expandableRegions.length > 0
    }

    // A FRESH expansion, as opposed to the second space of one already under way.
    // canStartExpansion above answers true mid-expansion, which is right for "is expanding still
    // part of this action" and wrong for "may this sword buy an expansion" - the rulebook allows
    // one expansion per action, and offering it again was offering the same one twice.
    get canStartFreshExpansion(): boolean {
        if (this.gameState.expansionUsed === true) return false
        if (this.gameState.expandingRegionId !== undefined) return false
        return this.canStartExpansion
    }

    // Set when the player has finished expanding at one space. The engine has no action for
    // "that's enough" - expandingRegionId stays set until the second space is taken or the action
    // ends - so declining it is local, like the step choice itself.
    //
    // It exists because knight squares are no longer offered while an expansion is open. Something
    // has to end the expansion, and it cannot be the knight click that used to end it.
    // Keyed to the expansion it refers to, for the same reason the step choice is keyed to its
    // step: a decline that applies to THIS expansion cannot leak into the next one, and nothing
    // has to notice the expansion ended in order to clear it.
    private declinedExpansion: string | undefined = $state(undefined)

    declineSecondSpace() {
        const openExpansion = this.openExpansionId
        if (openExpansion) this.declinedExpansion = openExpansion
    }

    // Identifies the expansion currently open, action and region together - the same region can be
    // expanded again in a later action, and that is a different expansion.
    private get openExpansionId(): string | undefined {
        const regionId = this.gameState.expandingRegionId
        if (!regionId) return undefined
        return `${this.currentKnightActionKey ?? 'none'}:${regionId}`
    }

    // The optional second space of an expansion already under way. Costs no sword - it was paid
    // for by the one that started it - so it outlives the step that bought it.
    get canContinueExpansion(): boolean {
        const openExpansion = this.openExpansionId
        return openExpansion !== undefined && this.declinedExpansion !== openExpansion
    }

    // Which shape the winner of a knight action has declared they're taking. A one-sword
    // action is just knight-or-expand; a two-sword action has exactly three legal shapes
    // (two knights, or one knight plus one expansion in either order - "using this
    // action to expand twice is not allowed"), so the player picks one up front and
    // every click after that is unambiguous. Purely local UI intent, like
    // selectedExpandRegionId - the engine only ever sees the individual
    // PlaceKnight/ExpandRegion actions this produces, and never enforces the order.
    // The choice, recorded against the STEP it was made for rather than as a bare value. That is
    // what makes it expire on its own: spending a sword changes the step id, so the stored choice
    // stops matching and knightPlan derives undefined - the next question is asked without anything
    // having to notice the sword was spent and clear up afterwards.
    //
    // Which is the repository's rule 34/35, and not merely the letter of it: the version that DID
    // notice and clear produced exactly the loop rule 24 warns about. Undo dropped the step, an
    // effect re-selected it, and the button appeared dead.
    private chosenStep: { stepId: string; plan: KnightPlan } | undefined = $state(undefined)

    // The step currently being answered: the action, plus how many swords are left to spend on it.
    private get knightStepId(): string | undefined {
        const actionKey = this.currentKnightActionKey
        if (!actionKey) return undefined
        return `${actionKey}:${this.gameState.knightsRemaining ?? 0}`
    }

    get knightPlan(): KnightPlan | undefined {
        const stepId = this.knightStepId
        const stored =
            stepId && this.chosenStep?.stepId === stepId ? this.chosenStep.plan : undefined

        // A stored choice whose half has since closed is stale - the knight stock ran dry, or the
        // last region got boxed in - and gives way to whatever is still on offer.
        if (stored && this.knightPlanStillOpen(stored)) return stored

        // With one option there is nothing to choose, so it counts as chosen. Derived rather than
        // written: an auto-selection that is not stored anywhere simply stops applying the moment a
        // second option appears, which is what an effect used to have to notice and undo. It is
        // also what tells an auto-selection from a deliberate one - only the deliberate one is
        // stored, so only it survives the arrival of a second option.
        const options = this.availableKnightPlans
        return options.length === 1 ? options[0] : undefined
    }

    private knightPlanStillOpen(plan: KnightPlan): boolean {
        return plan === 'knight' ? this.canPlaceAnotherKnight : this.canExpandRegion
    }

    // Identifies the knight action currently being performed: the action card, how many
    // slots had resolved when it started (pushed before the placement phase and stable
    // throughout it - see resolvingActions.ts), and whose action it is. Undefined outside
    // a knight phase.
    private get currentKnightActionKey(): string | undefined {
        const placingPlayerId = this.gameState.knightPlacingPlayerId
        if (!placingPlayerId) return undefined
        const cardId = this.gameState.currentActionCard?.id ?? 'none'
        return `${cardId}:${this.gameState.resolvedSlots.length}:${placingPlayerId}`
    }

    selectKnightPlan(plan: KnightPlan) {
        this.errorMessage = undefined
        const stepId = this.knightStepId
        if (!stepId) return
        this.chosenStep = { stepId, plan }
    }

    clearKnightPlan() {
        this.chosenStep = undefined
        this.cancelExpansion()
    }




    // Whether this knight ACTION has produced anything real yet - which decides whether Undo
    // cancels a choice or reverts a move.
    //
    // Read entirely off engine state, and deliberately not off expansionSquares: that derives from
    // the locally selected region, so anything that cleared the selection made a spent action look
    // untouched, and Undo would cancel the step and let it be re-chosen instead of reverting.
    //
    // Compared against the action's own sword count rather than the step's, because a step now
    // starts fresh after each sword: measuring against the step would report no progress at the
    // start of the second one, with a knight already on the board.
    get knightPlanHasProgress(): boolean {
        if (!this.knightPlan) return false
        return (
            this.gameState.expansionUsed === true ||
            this.gameState.expandingRegionId !== undefined ||
            (this.gameState.knightsRemaining ?? 0) < this.knightActionSwords
        )
    }

    // How many spaces the in-progress expansion has already taken, read straight off the
    // engine's own flag: the 2nd space is what clears expandingRegionId (see
    // ExpandRegion.apply), so a set id means exactly one space so far. expansionSquares
    // agrees with this now that it derives from the action log too, but this stays the
    // cheaper answer where only the count is needed.
    get expansionSpacesTaken(): number {
        return this.gameState.expandingRegionId !== undefined ? 1 : 0
    }

    // The region being expanded. Stored only when the player actually picks one.
    private chosenExpandRegion: string | undefined = $state(undefined)

    // Reads as nothing at all once the expanding stage closes - the expansion finished, a knight
    // went down instead, or the action ended - so a stale pick cannot outlive its usefulness and
    // nothing has to notice the stage closing in order to drop it.
    //
    // One region means there is nothing to pick, so it counts as picked. That also covers
    // re-entering an expansion the engine still has open, where expandableRegions is exactly that
    // region, so a second space cannot be misdirected at another one.
    get selectedExpandRegionId(): string | undefined {
        if (!this.expandStageActive) return undefined
        if (this.chosenExpandRegion) return this.chosenExpandRegion

        const regions = this.expandableRegions
        return regions.length === 1 ? regions[0].id : undefined
    }

    // The 1-2 spaces this expansion has taken, read back off the action log rather than
    // recorded locally as they're clicked. Each space is its own ExpandRegion action,
    // dispatched and optimistically applied the moment it's picked, so the log IS the
    // record - and deriving it means the UI can't disagree with the engine.
    //
    // It used to be a local array appended to after `await applyAction(...)`, which drifts:
    // GameSession.applyAction returns early while it's still busy and swallows rejections
    // without rethrowing, so a second click during the first round-trip appended a space
    // that was never dispatched. The board then tinted a square and drew walls the engine
    // didn't have, legalNextExpansionSquares saw 2 spaces and offered none, and the real 2nd
    // space became unreachable - all while the status line read "1/2" from engine state.
    // Deriving also self-heals on Undo, which the old comment noted it didn't.
    get expansionSquares(): { col: number; row: number }[] {
        const regionId = this.selectedExpandRegionId
        const myPlayerId = this.myPlayer?.id
        if (!regionId || !myPlayerId) return []

        // The expansion's spaces are always the trailing run of ExpandRegion actions for
        // this region: the engine emits nothing between them, and anything else in the log
        // (a knight placement, the resolution cascade) means that expansion is over.
        const spaces: { col: number; row: number }[] = []
        for (let index = this.actions.length - 1; index >= 0; index--) {
            const action = this.actions[index]
            if (!isExpandRegion(action)) break
            if (action.playerId !== myPlayerId || action.regionId !== regionId) break
            spaces.unshift({ col: action.space.col, row: action.space.row })
        }
        return spaces
    }

    selectRegionToExpand(regionId: string) {
        if (!this.canExpandRegion) return
        if (!this.expandableRegions.some((r) => r.id === regionId)) return
        this.errorMessage = undefined
        this.chosenExpandRegion = regionId
    }

    // Dropping the region selection empties expansionSquares by itself, since that derives
    // from the selected region (see above).
    cancelExpansion() {
        this.chosenExpandRegion = undefined
    }

    // The engine's own verdict on one hypothetical expansion - undefined if it's legal,
    // otherwise exactly the message ExpandRegion would reject it with. Every
    // expansion-legality question in this class goes through here so the client never
    // has its own second copy of the rules to drift out of sync.
    private expansionAttemptReason(
        regionId: string,
        space: { col: number; row: number }
    ): string | undefined {
        if (!this.myPlayer) return "It isn't your turn to expand a region."
        return expandRegionReason(this.gameState, this.myPlayer.id, regionId, space)
    }

    private isValidExpansionAttempt(regionId: string, space: { col: number; row: number }): boolean {
        return this.expansionAttemptReason(regionId, space) === undefined
    }

    // Squares that would legally extend the region-in-progress (adjacent to the
    // original region for the 1st pick, or to the region as extended by the 1st pick
    // for the 2nd, per the server's own current state) - never more than 2 total.
    get legalNextExpansionSquares(): { col: number; row: number }[] {
        const regionId = this.selectedExpandRegionId
        if (!regionId || this.expansionSquares.length >= 2) return []

        return legalExpansionSquares(this.gameState, this.myPlayer!.id, regionId)
    }

    // Why a region picked to expand has no legal target square - the distinct reasons
    // ExpandRegion itself gave for every square on that region's frontier (the
    // off-region squares orthogonally touching it, which is exactly the set adjacency
    // allows), so the UI can say WHICH rule is in the way instead of a bare "nowhere
    // legal". The invasion rule in particular is easy to be surprised by, so its
    // reason gets the actual knight counts attached.
    get expansionBlockedReasons(): string[] {
        const regionId = this.selectedExpandRegionId
        if (!regionId || !this.myPlayer) return []

        const matches = this.gameState.regions.filter((r) => r.id === regionId)
        if (matches.length === 0) return ['that region no longer exists']
        if (matches.length > 1) {
            // Two live regions sharing an id is broken state, not a rules situation,
            // and it silently breaks every find-by-id in the engine - including the one
            // that decides whether this is even your region (see detectNewRegions'
            // mintId, which stops NEW ids from colliding but can't repair older state).
            return [`two different regions share the id "${regionId}" - that's a bug, not a rule`]
        }
        const region = matches[0]
        const regionKeys = new Set(region.squareKeys)

        const frontier = new Set<string>()
        for (const key of region.squareKeys) {
            const [col, row] = key.split(',').map(Number)
            for (const n of neighbors(col, row)) {
                if (!isOnBoard(n.col, n.row)) continue
                const nKey = squareKey(n.col, n.row)
                if (regionKeys.has(nKey)) continue
                frontier.add(nKey)
            }
        }

        const reasons = new Set<string>()
        for (const key of frontier) {
            const [col, row] = key.split(',').map(Number)
            const reason = this.expansionAttemptReason(regionId, { col, row })
            if (reason) reasons.add(reason)
        }

        // Spell the knight comparison out with real numbers - "must outnumber" alone
        // doesn't say by how much you're short, and the counts are what a player would
        // otherwise be squinting at the board to tally.
        const outnumberedReason = [...reasons].find((r) => r.includes('outnumber'))
        if (outnumberedReason) {
            const myKnights = countKnights(region, this.gameState.board)
            // Only the neighbors whose knights actually hold this region off - a weaker
            // one next door (blocked for some other reason, e.g. every square of it that
            // touches this region is occupied) would make the comparison read as a lie.
            const blockingCounts = [...frontier]
                .map((key) => this.gameState.regions.find((r) => r.id !== region.id && r.squareKeys.includes(key)))
                .filter((r): r is Region => r !== undefined && r.ownerColor !== undefined)
                .map((r) => countKnights(r, this.gameState.board))
                .filter((count) => count >= myKnights)
            const weakestDefender = blockingCounts.length > 0 ? Math.min(...blockingCounts) : undefined
            reasons.delete(outnumberedReason)
            reasons.add(
                weakestDefender === undefined
                    ? outnumberedReason
                    : `your ${myKnights} knight${myKnights === 1 ? '' : 's'} here must outnumber the ${weakestDefender} in the neighboring region to invade it`
            )
        }

        return [...reasons].map((reason) => reason.charAt(0).toLowerCase() + reason.slice(1).replace(/\.$/, ''))
    }

    // Each space is its own ExpandRegion action (see expandRegion.ts) rather than a
    // batch of 1-2 submitted together, so Undo can step back one space at a time
    // instead of reverting a whole 2-space expansion in one go. A 1-space expansion
    // still waits for an explicit stop (Pass, via the "Confirm expansion" button -
    // see RealBoard.svelte) since the player might want to add a 2nd space instead;
    // the 2nd (once picked) always maxes out the expansion and ends the phase
    // server-side on its own, no separate confirm needed.
    async addExpansionSquare(col: number, row: number) {
        const regionId = this.selectedExpandRegionId
        if (!regionId || this.expansionSquares.length >= 2 || !this.myPlayer) return

        const space = { col, row }
        const reason = this.expansionAttemptReason(regionId, space)
        if (reason) {
            this.errorMessage = reason
            return
        }

        this.errorMessage = undefined
        const action = this.createPlayerAction(ExpandRegion, { regionId, space })
        // No local bookkeeping to update afterwards: expansionSquares reads the action log,
        // so a dispatch that was dropped (applyAction returns early while busy) simply
        // doesn't appear, instead of leaving the board drawing a space that isn't there.
        await this.applyAction(action)
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

        const invalidReason = lookAtPoliticsPileReason(this.gameState, action.playerId, pile)
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

        const invalidReason = takePoliticsCardReason(this.gameState, action.playerId, pile, cardId)
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
        if (playerState.knightsInStock <= 0) return false
        if (!playerState.politicsCards.some((c) => c.type === PoliticsCardType.Renegade)) return false
        // Holding the card and having a spare knight isn't enough - there also needs
        // to be at least one of the player's own regions with both a legal square for
        // the replacement knight AND a bordering enemy region with a knight actually
        // safe to remove, or the 4-step targeting flow would have nowhere to go.
        return this.myRegions.some(
            (region) =>
                this.regionHasRenegadeCandidateSquare(region, playerState) &&
                this.gameState.regions.some((r) => this.isEligibleRenegadeEnemyRegion(region, r))
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

    // Only true while playing one is still legal. The window can close from under the player - the
    // slot resolves, the card leaves the hand, the phase moves on - and an effect used to notice
    // that and cancel afterwards. Derived, it simply stops being true, and the four selections
    // below stop being read.
    get isPlayingRenegadeCard(): boolean {
        return this.renegadeCardId !== undefined && this.canPlayRenegadeCard
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

    // Whether a region has any square that could receive the Renegade's replacement
    // knight - same space/terrain/adjacency/affordability rules as a normal knight
    // placement (ignoring the possible extra removal-side wooded cost, which the
    // final confirmRenegadePlacement validates exactly). Shared by
    // legalRenegadeOwnRegionIds (restricted to the in-progress flow) and
    // canPlayRenegadeCard (checked across every region, to know up front whether the
    // card has any legal play at all).
    private regionHasRenegadeCandidateSquare(region: Region, playerState: HydratedLowenherzPlayerState): boolean {
        const board = this.gameState.board
        return region.squareKeys.some((key) => {
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
    }

    // Which of the player's own regions could actually receive the replacement
    // knight - a region with no candidate square at all (full, or its only wooded
    // spot they can't afford) can't be chosen as the starting region in the first
    // place.
    get legalRenegadeOwnRegionIds(): Set<string> {
        if (!this.isPlayingRenegadeCard || !this.myPlayer) return new Set()
        const playerState = this.gameState.getPlayerState(this.myPlayer.id)
        const result = new Set<string>()
        for (const region of this.myRegions) {
            if (!this.regionHasRenegadeCandidateSquare(region, playerState)) continue
            // A region with room for the replacement knight but nothing bordering it to
            // take one FROM is just as much a dead end, so it isn't offered either.
            if (!this.gameState.regions.some((r) => this.isEligibleRenegadeEnemyRegion(region, r))) continue
            result.add(region.id)
        }
        return result
    }

    // Whether `candidate` is a legal Renegade/Alliance target for `ownRegion` -
    // another prince's region, bordering ownRegion, with at least one knight actually
    // safe to remove (a region with none, or only knights whose removal would strand
    // another, can't be targeted at all). Shared by legalRenegadeEnemyRegions (the
    // in-progress flow's choices) and canPlayRenegadeCard (checked across every
    // region pair, to know up front whether the card has any legal play at all).
    private isEligibleRenegadeEnemyRegion(ownRegion: Region, candidate: Region): boolean {
        return (
            !!candidate.ownerColor &&
            candidate.ownerColor !== ownRegion.ownerColor &&
            regionsAreNeighboring(ownRegion, candidate) &&
            candidate.squareKeys.some((key) => {
                const [col, row] = key.split(',').map(Number)
                const square = getSquare(this.gameState.board, col, row)
                return (
                    square?.knightColor === candidate.ownerColor &&
                    isKnightSafeToRemove(this.gameState, candidate.ownerColor!, col, row)
                )
            })
        )
    }

    // Any of another prince's regions bordering the chosen own region - the pair of
    // regions Renegade (like Alliance) acts on.
    get legalRenegadeEnemyRegions(): Region[] {
        const ownRegion = this.gameState.regions.find((r) => r.id === this.renegadeOwnRegionId)
        if (!ownRegion) return []
        return this.gameState.regions.filter((r) => this.isEligibleRenegadeEnemyRegion(ownRegion, r))
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
        return (
            playRenegadeCardReason(this.gameState, this.myPlayer.id, {
                cardId: this.renegadeCardId,
                ownRegionId: this.renegadeOwnRegionId,
                enemyRegionId: this.renegadeEnemyRegionId,
                removedCol: this.renegadeRemovedSquare.col,
                removedRow: this.renegadeRemovedSquare.row,
                placedCol,
                placedRow
            }) === undefined
        )
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
            this.errorMessage = playRenegadeCardReason(this.gameState, myPlayer.id, {
                cardId: renegadeCardId,
                ownRegionId: renegadeOwnRegionId,
                enemyRegionId: renegadeEnemyRegionId,
                removedCol: renegadeRemovedSquare.col,
                removedRow: renegadeRemovedSquare.row,
                placedCol,
                placedRow
            })
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
        if (!playerState.politicsCards.some((c) => c.type === PoliticsCardType.Alliance)) return false
        // Holding the card isn't enough on its own - there also needs to be at least
        // one of the player's own regions bordering an enemy region it isn't already
        // allied with, or there'd be nothing legal to pick in the 2-step flow.
        return this.myRegions.some((region) =>
            this.gameState.regions.some((r) => this.isEligibleAllianceEnemyRegion(region, r))
        )
    }

    // Which Alliance card is currently being played, and whether the player has
    // picked their own region yet - a 2-step targeting flow (own region -> a
    // neighboring enemy region, which immediately confirms), same overall pattern as
    // the Renegade flow but shorter.
    allianceCardId: string | undefined = $state(undefined)
    allianceOwnRegionId: string | undefined = $state(undefined)

    // Same as isPlayingRenegadeCard: true only while it is still legal to be playing one.
    get isPlayingAllianceCard(): boolean {
        return this.allianceCardId !== undefined && this.canPlayAllianceCard
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

    // Whether `candidate` is a legal Alliance target for `ownRegion` - another
    // prince's region, bordering ownRegion, not already allied with it. Shared by
    // legalAllianceEnemyRegions (the in-progress flow's choices) and
    // canPlayAllianceCard (checked across every region pair, to know up front
    // whether the card has any legal play at all).
    private isEligibleAllianceEnemyRegion(ownRegion: Region, candidate: Region): boolean {
        return (
            !!candidate.ownerColor &&
            candidate.ownerColor !== ownRegion.ownerColor &&
            regionsAreNeighboring(ownRegion, candidate) &&
            !areRegionsAllied(this.gameState.alliances, ownRegion.id, candidate.id)
        )
    }

    // Which of the player's own regions can actually start an alliance - one with no
    // eligible neighbor (nothing bordering it but its own color, or only regions it's
    // already allied with) is a dead end, so it isn't offered as a choice at all rather
    // than being pickable and then answered with "that region has nothing to ally with,
    // click Undo". Same shape as legalRenegadeOwnRegionIds.
    get legalAllianceOwnRegionIds(): Set<string> {
        if (!this.isPlayingAllianceCard) return new Set()
        const result = new Set<string>()
        for (const region of this.myRegions) {
            if (this.gameState.regions.some((r) => this.isEligibleAllianceEnemyRegion(region, r))) {
                result.add(region.id)
            }
        }
        return result
    }

    // Any of another prince's regions bordering the chosen own region that isn't
    // already allied with it.
    get legalAllianceEnemyRegions(): Region[] {
        const ownRegion = this.gameState.regions.find((r) => r.id === this.allianceOwnRegionId)
        if (!ownRegion) return []
        return this.gameState.regions.filter((r) => this.isEligibleAllianceEnemyRegion(ownRegion, r))
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

        const invalidReason = playAllianceCardReason(this.gameState, myPlayer.id, {
            cardId: allianceCardId,
            ownRegionId: allianceOwnRegionId,
            enemyRegionId: regionId
        })
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

    // Every existing alliance the current player is a participant in and could afford to
    // cancel right now. "Any time" per the rulebook, which here means any time it's this
    // player's turn to act - laying a decision card, or spending an action they've won
    // (knights, walls, a politics card). Cancelling mid-knight-action is the one that
    // matters most: an alliance blocks expansion, so paying it off has to be possible in
    // the same breath as the expansion it unlocks. Being an active player is exactly the
    // engine's own gate (see HydratedCancelAlliance), which the platform enforces too.
    // The states whose handlers accept a CancelAlliance - kept in step with the engine's
    // state handlers so the board never offers a cancellation the engine would reject.
    // Negotiating/Dueling are deliberately left out even though both participants are
    // active there: money is mid-flight in both (a standing offer, a sealed bid), and
    // paying 10 ducats out from under one would leave a deal the player can no longer
    // honor.
    private static readonly ALLIANCE_CANCELLATION_STATES: MachineState[] = [
        MachineState.ChoosingActions,
        MachineState.PlacingWalls,
        MachineState.PlacingKnights,
        MachineState.TakingPoliticsCard
    ]

    get myCancellableAlliances(): { id: string; otherColor: Color }[] {
        if (!this.myPlayer || !this.gameState.activePlayerIds.includes(this.myPlayer.id)) return []
        if (!LowenherzGameSession.ALLIANCE_CANCELLATION_STATES.includes(this.gameState.machineState)) {
            return []
        }
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

        const invalidReason = cancelAllianceReason(this.gameState, this.myPlayer.id, allianceId)
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
                // engine-level test) acting as the other player. Checked in this order
                // (propose before sign) since canSignNegotiationOffer no longer requires
                // an offer to already exist - see its own comment.
                if (!this.gameState.negotiation?.offer) {
                    const myMoney = this.gameState.getPlayerState(this.myPlayer.id).money
                    await this.proposeNegotiationOffer(this.myPlayer.id, Math.min(1, myMoney))
                } else if (this.canSignNegotiationOffer) {
                    await this.signNegotiationOffer()
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
