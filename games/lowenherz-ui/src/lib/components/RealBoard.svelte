<script lang="ts">
    import { onMount } from 'svelte'
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Color, GameAction } from '@tabletop/common'
    import {
        ALLIANCE_CANCELLATION_COST,
        BOARD_COLS,
        BOARD_ROWS,
        HydratedPlaceCastle,
        isAdvanceResolution,
        isCancelAlliance,
        isDrawActionCard,
        isExpandRegion,
        isNegotiationMove,
        isOnBoard,
        isPlaceWall,
        isPlayRenegadeCard,
        isSubmitDuelBid,
        MachineState,
        type Negotiation,
        NegotiationMoveKind,
        neighbors,
        type SubmitDuelBid,
        squareKey,
        SquareType,
        wallBetween,
        type BoardTileId,
        type Wall
    } from '@tabletop/lowenherz'
    import boardTileA from '$lib/images/board/board-a.jpg'
    import boardTileB from '$lib/images/board/board-b.jpg'
    import boardTileC from '$lib/images/board/board-c.jpg'
    import boardTileD from '$lib/images/board/board-d.jpg'
    import boardTileE from '$lib/images/board/board-e.jpg'
    import boardTileF from '$lib/images/board/board-f.jpg'
    import RampartBorder from './RampartBorder.svelte'
    import RampartCorner from './RampartCorner.svelte'
    import WallSegment from './WallSegment.svelte'
    import PlayerPill from './PlayerPill.svelte'
    import ActionDescription from './ActionDescription.svelte'
    import knightFill from '$lib/images/pieces/knight-fill.png'
    import knightLines from '$lib/images/pieces/knight-lines.png'
    import castleFill from '$lib/images/pieces/castle-fill.png'
    import castleLines from '$lib/images/pieces/castle-lines.png'
    import iconMoneybagFill from '$lib/images/action-cards/icons/icon-moneybag-transparent.png'
    import iconMoneybagLines from '$lib/images/action-cards/icons/icon-moneybag-lines.png'
    import { playerName } from '$lib/model/actionCardHelpers.js'
    import type { KnightPlan } from '$lib/model/session.svelte.js'

    const gameSession = getGameSession()


    // roundAdvanced marks the END of a round, so scanning backward from "now" always
    // hits it BEFORE anything else that happened earlier in the very round we're
    // trying to inspect (money bag payouts, a completed negotiation, duel bids, etc.)
    // - stopping on the first one would mean never finding anything, even when it's
    // squarely within the round the message is meant to describe. The first
    // roundAdvanced just closes out that round; only a SECOND one confirms we've

    // A slot's resolution is "stale" (superseded, no longer the single most recent
    // notable thing) once a later slot has resolved since it - resolvedSlots grows
    // by exactly one, in order, every time ANY slot fully resolves (money bag, solo
    // win, negotiation, or duel - see resolutionHelpers/negotiationMove/dueling),
    // so a slot's own number matching its current length means nothing has











    // Mirrors the shared standing offer once one exists, so both negotiators see the
    // same live draft; before any offer exists, defaults to "I offer" for whichever
    // negotiator this session is, at a 1-ducat opening amount. Purely a local draft
    // until the player actually does something (touches the stepper, or clicks
    // Signed - see the Signed button below, which proposes this draft for real
    // first if nothing's been proposed yet). Deliberately NOT auto-submitted the
    // moment negotiation starts - that used to happen so the Signed button was
    // immediately usable, but it meant a real action always existed the instant a
    // negotiation began, and that action (being the nearest one) was always what
    // Undo targeted - hiding whatever the player actually wanted to undo back to.



    // What the negotiation panel actually renders - the live negotiation normally,
    // or the frozen snapshot during the brief hold after it just finished (see
    // above). Everything below reads this instead of gameState.negotiation directly.
    const displayNegotiation = $derived(gameSession.gameState.negotiation ?? gameSession.frozenNegotiation)



    // The payer dropdown and the amount stepper edit a local draft only - nothing is
    // dispatched until the player commits by signing. Every stepper click used to submit a
    // real NegotiationMove.Propose, so nudging an offer from 1 to 8 wrote seven actions into
    // the game log, each of them the nearest undoable action: undoing the decision card that
    // started the negotiation meant pressing Undo eight times, back through your own
    // fiddling. (A comment further up records that an auto-proposal was removed for exactly
    // this reason; the stepper had reintroduced it one click at a time.) The trade-off is
    // that the other player doesn't watch the number move - they see the offer when it's
    // made.




    // Master switch for the bid-on-another-player's-behalf affordance, same pattern as
    // TestingControls' own constant - it only exists because hotseat resolves myPlayer
    // to a single duelist, so a solo tester otherwise can't finish a duel at all.
    //
    // Off for beta: a tester who can bid for their opponent can settle a duel from one
    // seat, which is not a shortcut through the flow but a way to decide someone else's
    // ducats for them. Everything behind it is intact - flip this back to true for
    // another solo pass.


    const board = $derived(gameSession.gameState.board)
    const regions = $derived(gameSession.gameState.regions)
    const alliances = $derived(gameSession.gameState.alliances)
    const tileLayout = $derived(board.tileLayout ?? [])

    // A wall's two endpoints, in grid-corner coordinates - west edges run from
    // (col,row) down to (col,row+1); north edges run from (col,row) right to
    // (col+1,row). Only interior walls are ever stored (the board's outer edge is an
    // always-there implicit wall - see isWalledBetween), but an interior wall can
    // still have ONE endpoint land exactly on the outer boundary if it's in the
    // first/last row or column.
    function wallEndpoints(wall: Wall): [[number, number], [number, number]] {
        return wall.edge === 'west'
            ? [
                  [wall.col, wall.row],
                  [wall.col, wall.row + 1]
              ]
            : [
                  [wall.col, wall.row],
                  [wall.col + 1, wall.row]
              ]
    }
    function isCornerOnBoardBoundary(cx: number, cy: number): boolean {
        return cx === 0 || cx === BOARD_COLS || cy === 0 || cy === BOARD_ROWS
    }
    // Suppresses the yellow junction octagon wherever a placed wall meets the
    // rampart frame around the edge of the board - there's no other wall there to
    // blend with (that's what the octagon marker is for), just the board's edge.
    function wallJunctionVisibility(wall: Wall): { hideStart: boolean; hideEnd: boolean } {
        const [start, end] = wallEndpoints(wall)
        return {
            hideStart: isCornerOnBoardBoundary(start[0], start[1]),
            hideEnd: isCornerOnBoardBoundary(end[0], end[1])
        }
    }

    // One entry per alliance, with every boundary wall that sits directly between its
    // two allied regions - each of those walls carries a heart, the alliance's only
    // on-board indication. "wall north of (c,r)" separates (c,r) from (c,r-1); "wall west
    // of (c,r)" separates (c,r) from (c-1,r) - see model/board.ts's wallBetween().
    // Grouped by alliance (rather than a flat wall list) because the hearts are also the
    // control for cancelling one, which is an alliance-wide interaction: hovering any of
    // its hearts previews the whole alliance ending.
    const myCancellableAllianceIds = $derived(
        new Map(gameSession.myCancellableAlliances.map((a) => [a.id, a.otherColor]))
    )

    const allianceMarkers = $derived(gameSession.allianceMarkers)

    // Where a heart sits for a given boundary wall - the same maths the markers and the
    // burst below both need, so neither can drift from the other.
    function heartPosition(wall: { col: number; row: number; edge: string }) {
        return {
            left: (wall.edge === 'west' ? wall.col * CELL_SIZE : wall.col * CELL_SIZE + CELL_SIZE / 2) - 12,
            top: (wall.edge === 'west' ? wall.row * CELL_SIZE + CELL_SIZE / 2 : wall.row * CELL_SIZE) - 12
        }
    }

    // Cancelling an alliance deletes it from state, so by the time we hear about the
    // action its hearts are already gone from allianceMarkers and there is nothing left to
    // animate. This keeps the last known wall positions per alliance so the burst still
    // knows where to play. A plain Map, not $state: nothing renders from it directly.
    const lastKnownAllianceWalls = new Map<string, { col: number; row: number; edge: string }[]>()

    // Refreshed from the per-action listener rather than by an effect mirroring allianceMarkers.
    // Same timing either way - the listener runs after each applied action, so the map holds
    // whatever was on the board before the NEXT one - and it keeps the record next to the burst
    // that consumes it instead of in a watcher three hundred lines away.
    function rememberAllianceWalls() {
        for (const marker of allianceMarkers) {
            lastKnownAllianceWalls.set(marker.id, marker.walls)
        }
    }

    type AllianceBurst = { id: string; left: number; top: number }
    let allianceBursts: AllianceBurst[] = $state([])
    const ALLIANCE_BURST_MS = 700
    // Directions the shards fly. Not evenly spaced round the circle - a slightly irregular
    // spray reads as something breaking rather than as a diagram.
    const BURST_SHARD_ANGLES = [-72, -28, 14, 58, 104, 152, 196, 250]

    // The renegade knight changing sides: it lifts off its old square, arcs across, and
    // settles on the new one having taken the new owner's colour on the way. Renegade is
    // "remove theirs, place yours" in the rules, but as a single gesture it reads as one
    // knight defecting - which is what the card is called.
    type RenegadeFlight = {
        id: string
        left: number
        top: number
        dx: number
        dy: number
        toCol: number
        toRow: number
        fromColor: Color
        toColor: Color
    }
    let renegadeFlight: RenegadeFlight | undefined = $state(undefined)
    const RENEGADE_FLIGHT_MS = 900

    // The landing square already holds the new knight the moment the action applies, so it
    // is hidden for the duration - otherwise the piece would be sitting there waiting while
    // its own arrival is still in the air.
    function isRenegadeArrivalSquare(col: number, row: number): boolean {
        return renegadeFlight !== undefined && renegadeFlight.toCol === col && renegadeFlight.toRow === row
    }

    function flyRenegadeKnight(action: { id: string; playerId: string; metadata?: unknown }) {
        const metadata = action.metadata as
            | { victimColor: Color; removedSquareKey: string; placedSquareKey: string }
            | undefined
        if (!metadata) return

        const [fromCol, fromRow] = metadata.removedSquareKey.split(',').map(Number)
        const [toCol, toRow] = metadata.placedSquareKey.split(',').map(Number)
        const mover = gameSession.gameState.getPlayerState(action.playerId)

        renegadeFlight = {
            id: action.id,
            left: fromCol * CELL_SIZE,
            top: fromRow * CELL_SIZE,
            dx: (toCol - fromCol) * CELL_SIZE,
            dy: (toRow - fromRow) * CELL_SIZE,
            toCol,
            toRow,
            fromColor: metadata.victimColor,
            toColor: mover.color
        }

        setTimeout(() => {
            if (renegadeFlight?.id === action.id) renegadeFlight = undefined
        }, RENEGADE_FLIGHT_MS)
    }

    function burstAlliance(allianceId: string) {
        const walls = lastKnownAllianceWalls.get(allianceId)
        if (!walls || walls.length === 0) return

        const added = walls.map((wall, i) => ({
            id: `${allianceId}-${wall.col},${wall.row},${wall.edge}-${i}`,
            ...heartPosition(wall)
        }))
        allianceBursts = [...allianceBursts, ...added]

        setTimeout(() => {
            const spent = new Set(added.map((burst) => burst.id))
            allianceBursts = allianceBursts.filter((burst) => !spent.has(burst.id))
            lastKnownAllianceWalls.delete(allianceId)
        }, ALLIANCE_BURST_MS)
    }

    // Cancelling costs 10 ducats and is legal at any time, so the affordance lives on the
    // board rather than in the turn-scoped status text. One click does it: the hover state
    // (broken heart, the wall sweeping back, the -10 medallion) is the confirmation step,
    // so a second click would only ask a question already answered - and Undo covers a
    // genuine misclick.
    let hoveredAllianceId: string | undefined = $state(undefined)

    function allianceCancelLabel(marker: { otherColor?: Color }): string {
        const otherPlayerId = marker.otherColor ? gameSession.playerIdForColor(marker.otherColor) : undefined
        const other = otherPlayerId ? playerName(gameSession, otherPlayerId) : 'a neutral prince'
        return `Cancel your alliance with ${other} for ${ALLIANCE_CANCELLATION_COST} ducats`
    }

    const tileImages: Record<BoardTileId, string> = {
        A: boardTileA,
        B: boardTileB,
        C: boardTileC,
        D: boardTileD,
        E: boardTileE,
        F: boardTileF
    }

    // Expensive (re-scans the whole board with a validity check per candidate edge).
    // Must be computed ONCE per render via $derived, not re-invoked from inside a
    // per-square/per-edge check function - otherwise a 150-square grid would call it
    // 150 times each render (O(n^2), which got dramatically worse as more regions
    // accumulated from wall placement, since region-membership checks scale with
    // region count - that's what froze the page after "placing a bunch of walls").
    const legalCastleSquareSet = $derived(
        new Set(gameSession.legalCastleSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalWallEdges = $derived(gameSession.legalWallEdges)
    const legalKnightSquareSet = $derived(
        new Set(gameSession.legalKnightSquares.map((s) => `${s.col},${s.row}`))
    )
    // For the fading "ghost knight" preview on legal placement squares - the piece
    // it would actually place, so it's shown in the player's own color.
    const myColor = $derived(
        gameSession.myPlayer ? gameSession.gameState.getPlayerState(gameSession.myPlayer.id).color : undefined
    )
    // What the next setup placement will really be: your own color at first, the neutral
    // prince's for the closing laps (see GameSession.placementColor). Distinct from
    // myColor, which is right for every mid-game preview but wrong during those laps.
    const placementColor = $derived(gameSession.placementColor)


    const legalExpansionSquareSet = $derived(
        new Set(gameSession.legalNextExpansionSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalRenegadeEnemyRegionIds = $derived(new Set(gameSession.legalRenegadeEnemyRegions.map((r) => r.id)))
    const legalRenegadeRemovableSquareSet = $derived(
        new Set(gameSession.legalRenegadeRemovableSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalRenegadePlacementSquareSet = $derived(
        new Set(gameSession.legalRenegadePlacementSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalAllianceEnemyRegionIds = $derived(new Set(gameSession.legalAllianceEnemyRegions.map((r) => r.id)))
    // These two are hoisted for the same reason as the sets above, and it matters more
    // here: both are plain class getters (unmemoized), and legalRenegadeOwnRegionIds walks
    // every square of every region of yours and runs a knight-connectivity BFS per
    // candidate. They're consulted from per-square helpers inside the 150-cell grid loop,
    // so reading them straight off the session recomputed the whole thing once per square -
    // the same O(n^2) shape that froze the board once before (see the note above).
    // Which region owns each square, built once per render. regionAt/regionTint are called
    // for all ~150 squares of the grid, and both used to run regions.find(r =>
    // r.squareKeys.includes(key)) - a scan of every region, and within each a scan of its
    // square keys comparing strings. A dozen regions of ten squares each is ~120 string
    // compares per square, ~18k per render, re-run on every reactive change including the
    // hoverPoint updates that fire on mouse move. Same hoisting the sets below already got.
    const regionBySquareKey = $derived.by(() => {
        const map = new Map<string, (typeof regions)[number]>()
        for (const region of regions) {
            for (const key of region.squareKeys) map.set(key, region)
        }
        return map
    })
    // Region ids by ownership, for the same reason: myRegions/expandableRegions are plain
    // getters that filter the whole regions array on every read, and the helpers below are
    // called once per square.
    const myRegionIdSet = $derived(new Set(gameSession.myRegions.map((r) => r.id)))
    const expandableRegionIdSet = $derived(new Set(gameSession.expandableRegions.map((r) => r.id)))
    const legalRenegadeOwnRegionIdSet = $derived(gameSession.legalRenegadeOwnRegionIds)
    const legalAllianceOwnRegionIdSet = $derived(gameSession.legalAllianceOwnRegionIds)

    // The knight action is driven by a plan declared up front (see
    // GameSession.knightPlan) rather than a mode the player toggles: everything below
    // derives which half of the action a board click means from that plan plus what the
    // engine says has been spent, so no confirm/cancel chrome is needed - Undo backs out
    // of the plan (or the last real placement) instead.
    const knightSwordsLeft = $derived(gameSession.gameState.knightsRemaining ?? 0)
    const expansionStarted = $derived(gameSession.gameState.expansionUsed === true)

    // The plans actually on the table right now. A two-sword action is the interesting
    // case: two knights, or one knight plus one expansion in either order. Either half
    // can also be unavailable on its own (an empty knight stock or nowhere legal to
    // place; no region of your own to expand), which just prunes the list.
    const availableKnightPlans = $derived(gameSession.availableKnightPlans)


    // All four now live on the session, which the board's click handling and the status panel's
    // wording both read. Kept under their old names here so the call sites below are unchanged.
    const expandStageActive = $derived(gameSession.expandStageActive)
    const expansionDeadEnd = $derived(gameSession.expansionDeadEnd)
    const expansionBlockedReasons = $derived(
        expansionDeadEnd ? gameSession.expansionBlockedReasons : []
    )

    const knightStageActive = $derived(gameSession.knightStageActive)

    // Drop a plan belonging to an earlier knight action, so a previous player's plan (or
    // this player's own from a previous action) can't carry over - otherwise
    // canExpandRegion would correctly show the choice, but legalNextExpansionSquares
    // silently computed legality against the wrong (stale) region id and came back empty,
    // making it look like there was nothing to click. Keyed to the action itself rather
    // than "the placing player changed", so an Undo that steps back into an action that
    // had already ended keeps its plan (see syncKnightPlanWithState).
    // No effect keeps the step choice in step with game state any more. The choice is stored
    // against the step it was made for, so a stale one simply stops matching - see
    // GameSession.knightPlan.

    // Also declared in StatusMessages, which owns the buttons. Two lines in two places rather
    // than a session method, because the write it makes is to session state either way and the
    // indirection would hide that.
    function choosePlan(plan: KnightPlan) {
        gameSession.selectKnightPlan(plan)
    }

    // What drives the two-step shape of a two-sword action.
    //
    // Once a step's sword is spent, the step is over: the choice is dropped so the question is
    // asked again for the sword that is left. That is the whole mechanism - the second question
    // is the first one asked twice, and it narrows itself because canStartExpansion is already
    // false once an expansion has been used.
    //
    // Four effects used to live here: auto-select the only step, drop a step whose half had
    // closed, drop a step when expansion turned out to be possible after all, cancel a region
    // selection when the expanding stage closed, and auto-select a lone region. Every one watched
    // state and then wrote or cleared local UI state - rule 35's exact prohibition, and the shape
    // that produced the Undo loop.
    //
    // They are all derivations now, in GameSession.knightPlan and .selectedExpandRegionId. An
    // auto-selection that is derived rather than written stops applying by itself when a second
    // option appears, and a stored choice is by definition the deliberate one - so the flag that
    // used to tell those two apart is gone with them.

    // Starting to play a Renegade/Alliance card is local-only UI state, and the window to play
    // one can close from under the player - the slot resolves, the phase moves on. Two effects
    // used to notice that and cancel the play afterwards.
    //
    // GameSession.isPlayingRenegadeCard / isPlayingAllianceCard now answer false the moment
    // playing one stops being legal, so there is nothing to cancel: the flow reads as not in
    // progress, and the card id it left behind is never consulted again.

    // Floating "+N"/"-N" popups near wherever a region was just created, expanded,
    // invaded, or shrunk - one per scoring event, in the affected player's color,
    // auto-removed after a couple seconds. Fired from PlaceWall/ExpandRegion actions as they
    // are applied, reading their metadata for exact anchor squares/amounts - see the
    // anchorSquareKey fields on PlaceWallMetadata/ExpandRegionMetadata.
    type ScorePopup = { id: string; col: number; row: number; text: string; color: string }
    let popups: ScorePopup[] = $state([])
    let popupSeq = 0

    // Timings for one popup's life, in seconds, all owned by gsap below. They used to be owned
    // twice - a 4s CSS keyframe for the motion and a 4000ms setTimeout for the removal - which
    // could only ever agree by hand, and drifted the moment either was tuned.
    const POPUP_APPEAR_S = 0.18
    const POPUP_HOLD_S = 2.2
    const POPUP_FLOAT_S = 1.6

    function addPopup(anchorKey: string, amount: number, color: string) {
        if (amount === 0) return
        const [col, row] = anchorKey.split(',').map(Number)
        // A plain counter, not Date.now()/Math.random(): this id exists only to key the each
        // block, and a monotonic one cannot collide when several popups are added in one action.
        const id = `popup-${++popupSeq}`
        popups = [...popups, { id, col, row, text: amount > 0 ? `+${amount}` : `${amount}`, color }]
    }

    // The popup's motion belongs to the node's own lifetime, so it is attached to the node and
    // gsap's onComplete is the single owner of when the popup goes away.
    //
    // Deliberately NOT on the shared actionTimeline, unlike the card flip in DeckPiles: the
    // session holds the reactive state update until that timeline finishes, so putting a
    // multi-second float on it would stall the board after every scoring action. A popup is an
    // annotation that outlives the state change rather than part of the action's own motion - so
    // it gets its own timeline, and the transient state exists only for presence (the tween never
    // writes reactive state per frame; it writes it once, at the end, to unmount the node).
    function floatPopup(id: string) {
        return (node: HTMLElement) => {
            // xPercent/yPercent centre the popup on its anchor and compose with the y tween
            // below, so gsap can own the whole transform - the old keyframes did the centring
            // with a translate(-50%, -50%) baked into every frame.
            gsap.set(node, { xPercent: -50, yPercent: -50, transformOrigin: 'center center' })
            const timeline = gsap.timeline()
            timeline.fromTo(
                node,
                { scale: 0.6, opacity: 0 },
                { scale: 1, opacity: 1, duration: POPUP_APPEAR_S, ease: 'back.out(2)' },
                0
            )
            timeline.to(
                node,
                {
                    y: -32,
                    opacity: 0,
                    duration: POPUP_FLOAT_S,
                    ease: 'power1.out',
                    onComplete: () => {
                        popups = popups.filter((popup) => popup.id !== id)
                    }
                },
                POPUP_APPEAR_S + POPUP_HOLD_S
            )
            return () => timeline.kill()
        }
    }

    function popupsForCompletedRegions(
        regions: { ownerColor?: Color; points: number; anchorSquareKey: string }[] | undefined
    ) {
        for (const region of regions ?? []) {
            // Slate rather than the gray prince's #888888 - an unowned region's popup
            // shouldn't read as that player's (see NEUTRAL_ZONE_PAINT).
            const color = region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#3f3f46'
            addPopup(region.anchorSquareKey, region.points, color)
        }
    }

    function popupsForAction(action: GameAction) {
        // First, and this is the whole trick: during a listener the exposed gameState is still the
        // state BEFORE this action, so allianceMarkers still holds the alliance this action may be
        // about to cancel. Capturing here means burstAlliance below finds the hearts it needs.
        rememberAllianceWalls()

        if (isPlaceWall(action)) {
            popupsForCompletedRegions(action.metadata?.completedRegions)
        } else if (isExpandRegion(action)) {
            if (action.metadata?.pointsGained) {
                const color = gameSession.colors.getUiColor(
                    gameSession.gameState.getPlayerState(action.playerId).color
                )
                addPopup(squareKey(action.space.col, action.space.row), action.metadata.pointsGained, color)
            }
            for (const invasion of action.metadata?.invasions ?? []) {
                const victimColor = gameSession.colors.getUiColor(invasion.victimColor)
                addPopup(invasion.directAnchorSquareKey, -invasion.directPointsLost, victimColor)
                if (invasion.disconnectedAnchorSquareKey) {
                    addPopup(invasion.disconnectedAnchorSquareKey, -invasion.disconnectedPointsLost, victimColor)
                }
            }
            popupsForCompletedRegions(action.metadata?.completedRegions)
        } else if (isPlayRenegadeCard(action)) {
            flyRenegadeKnight(action)
        } else if (isCancelAlliance(action)) {
            // Fires from the same per-action listener as the score popups, so it plays once,
            // for everyone at the table, and stays quiet while scrubbing history.
            burstAlliance(action.allianceId)
        }

    }

    // The session tells us about each action as it is applied, one at a time and in order, so
    // there is nothing here to notice or diff. That is the whole reason this is a listener and
    // not an $effect: an effect can only watch gameSession.actions and work out for itself which
    // entries are new, which needs a high-water mark, a mount baseline to avoid replaying the
    // whole game, and a guard for the history controls shrinking and regrowing the list. All
    // three were bookkeeping for information the session already had.
    //
    // Still skipped while scrubbing history: those points were scored long ago, and flashing a
    // "-8" over a player who has just lost nothing is what the old high-water mark was working
    // around.
    onMount(() => {
        // Seeded here as well as after each action: the listener only runs when one arrives, and a
        // board already carrying alliances can have its first action be the cancellation of one.
        rememberAllianceWalls()

        const listener = async ({ action }: { action?: GameAction }) => {
            if (!action || gameSession.isViewingHistory) return
            popupsForAction(action)
        }

        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
    })

    const CELL_SIZE = 44
    const TILE_SIZE = 5
    const TILE_PX = TILE_SIZE * CELL_SIZE
    // +4 accounts for the squares grid's own border-2 (2px on each side) - explicit
    // pixel sizes (not "auto") so the rampart frame's middle track always matches the
    // board's actual rendered box exactly, with no gap on any edge.
    const boardWidthPx = $derived(board.squares[0].length * CELL_SIZE + 4)
    const boardHeightPx = $derived(board.squares.length * CELL_SIZE + 4)

    // Mouse position in BOARD pixels - i.e. the same unscaled coordinate space as
    // CELL_SIZE and every left/top below, not screen pixels. The board is rendered
    // inside ScalingWrapper's CSS transform (see GameTable), so a raw
    // clientX - rect.left is screen-space and comes out multiplied by the current
    // scale: fine at 1:1, but at (say) 0.85 the ghost wall drifted further and further
    // up-left of the cursor the further from the board's top-left corner you went - two
    // whole cells off in the far corner, which made the thin wall hit-boxes feel like
    // they'd moved. Undefined whenever the cursor isn't over the board at all, which is
    // exactly when the ghost wall preview should show nothing.
    let hoverPoint: { x: number; y: number } | undefined = $state(undefined)

    // The scale ScalingWrapper is currently applying, read off the element itself
    // (getBoundingClientRect is post-transform, offsetWidth is pre-transform layout)
    // rather than plumbed down from the wrapper - no coordination needed, and it stays
    // correct through window resizes and the wrapper's own zoom controls.
    function boardPointFromEvent(el: HTMLElement, clientX: number, clientY: number) {
        const rect = el.getBoundingClientRect()
        const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1
        const safeScale = scale > 0 ? scale : 1
        return { x: (clientX - rect.left) / safeScale, y: (clientY - rect.top) / safeScale }
    }

    // Whichever legal wall edge's clickable hit-box center is closest to the mouse -
    // the one spot that gets the pulsing ghost preview, rather than glowing every
    // legal spot at once.
    const nearestWallEdge = $derived.by(() => {
        if (!hoverPoint) return undefined
        let best: (typeof legalWallEdges)[number] | undefined
        let bestDistSq = Infinity
        for (const edge of legalWallEdges) {
            const sameRow = edge.row1 === edge.row2
            const cx = sameRow ? edge.col2 * CELL_SIZE : edge.col1 * CELL_SIZE + CELL_SIZE / 2
            const cy = sameRow ? edge.row1 * CELL_SIZE + CELL_SIZE / 2 : edge.row2 * CELL_SIZE
            const distSq = (cx - hoverPoint.x) ** 2 + (cy - hoverPoint.y) ** 2
            if (distSq < bestDistSq) {
                bestDistSq = distSq
                best = edge
            }
        }
        return best
    })

    // The canonical col/row/edge form (matching how real placed walls are stored and
    // rendered) for whichever edge is currently nearest the mouse.
    // Whether the cursor is currently over a village square. Villages are worth 5 power
    // points each and decide a lot of scoring, but on the printed tiles they sit in the
    // same palette as forests and hills and are easy to lose. Hovering one lights up every
    // village on the board, so a player can see the whole set at a glance without a legend
    // or a permanent highlight cluttering the board.
    //
    // Read off hoverPoint (board pixels, already tracked for the ghost wall) rather than
    // per-square mouse handlers - that would be one pair of listeners on every square of
    // the grid to answer a question the board already knows the answer to.
    const hoveringVillage = $derived.by(() => {
        if (!hoverPoint) return false
        const col = Math.floor(hoverPoint.x / CELL_SIZE)
        const row = Math.floor(hoverPoint.y / CELL_SIZE)
        if (!isOnBoard(col, row)) return false
        return board.squares[row]?.[col]?.type === SquareType.Village
    })

    // Löwenherz is Teuber's, and its princes compete to succeed a King while paying in
    // ducats - Holy Roman Empire rather than England, whose coin was the pound. These are
    // all real towns that were long established by the 1100s, so a board reads as a
    // plausible stretch of the Empire rather than as invented fantasy names.
    const VILLAGE_NAMES = [
        'Quedlinburg', 'Goslar', 'Bamberg', 'Speyer', 'Worms', 'Trier',
        'Regensburg', 'Hildesheim', 'Soest', 'Naumburg', 'Fulda', 'Eisenach',
        'Marburg', 'Nördlingen', 'Meissen', 'Erfurt', 'Passau', 'Konstanz',
        'Rothenburg', 'Dinkelsbühl', 'Landshut', 'Görlitz', 'Wetzlar', 'Hameln'
    ]

    // Every village on the board with the name it keeps for the whole game. Assigned in
    // row-major order rather than at random, so every player at the table sees the same
    // name on the same square without any of it having to live in game state.
    const villages = $derived.by(() => {
        const found: { col: number; row: number; name: string }[] = []
        for (let row = 0; row < board.squares.length; row++) {
            for (let col = 0; col < board.squares[row].length; col++) {
                if (board.squares[row][col].type === SquareType.Village) {
                    found.push({ col, row, name: VILLAGE_NAMES[found.length % VILLAGE_NAMES.length] })
                }
            }
        }
        return found
    })

    const ghostWall = $derived.by(() => {
        const edge = nearestWallEdge
        if (!edge) return undefined
        return wallBetween(edge.col1, edge.row1, edge.col2, edge.row2)
    })

    // One pulsing directional arrow per legal expansion target, centered on the wall
    // it would cross - a replacement for ringing every legal square, once a region has
    // been picked to expand. Each candidate is adjacent to exactly the region-as-grown-
    // so-far (never diagonal - see ExpandRegion's own adjacency check), so there's
    // always a real wall between it and whichever already-claimed square it borders.
    const expansionArrows = $derived.by(() => {
        if (!expandStageActive || !gameSession.selectedExpandRegionId) return []
        const region = gameSession.gameState.regions.find((r) => r.id === gameSession.selectedExpandRegionId)
        if (!region) return []

        const claimed = new Set(region.squareKeys)
        for (const s of gameSession.expansionSquares) claimed.add(squareKey(s.col, s.row))

        const result: {
            key: string
            wall: NonNullable<ReturnType<typeof wallBetween>>
            direction: 'north' | 'south' | 'east' | 'west'
        }[] = []
        for (const candidate of gameSession.legalNextExpansionSquares) {
            const neighbor = neighbors(candidate.col, candidate.row).find((n) => claimed.has(squareKey(n.col, n.row)))
            if (!neighbor) continue
            const wall = wallBetween(neighbor.col, neighbor.row, candidate.col, candidate.row)
            if (!wall) continue

            let direction: 'north' | 'south' | 'east' | 'west'
            if (candidate.row < neighbor.row) direction = 'north'
            else if (candidate.row > neighbor.row) direction = 'south'
            else if (candidate.col < neighbor.col) direction = 'west'
            else direction = 'east'

            result.push({ key: `${candidate.col},${candidate.row}`, wall, direction })
        }
        return result
    })

    const ARROW_ROTATION: Record<'north' | 'south' | 'east' | 'west', number> = {
        north: 0,
        east: 90,
        south: 180,
        west: 270
    }

    // Walls around whichever space(s) have been picked for the region-in-progress but
    // not yet confirmed/dispatched - drawn the same way ExpandRegion itself would draw
    // them once applied (every edge that doesn't border the rest of the hypothetical
    // region), so the picked space visually reads as already merged in.
    const expansionPreviewWalls = $derived.by(() => {
        if (!expandStageActive || gameSession.expansionSquares.length === 0) return []
        const region = gameSession.gameState.regions.find((r) => r.id === gameSession.selectedExpandRegionId)
        if (!region) return []

        const claimed = new Set(region.squareKeys)
        for (const s of gameSession.expansionSquares) claimed.add(squareKey(s.col, s.row))

        const seen = new Set<string>()
        const result: NonNullable<ReturnType<typeof wallBetween>>[] = []
        for (const space of gameSession.expansionSquares) {
            for (const n of neighbors(space.col, space.row)) {
                if (!isOnBoard(n.col, n.row)) continue
                if (claimed.has(squareKey(n.col, n.row))) continue
                const wall = wallBetween(space.col, space.row, n.col, n.row)
                if (!wall) continue
                const wallKey = `${wall.col},${wall.row},${wall.edge}`
                if (seen.has(wallKey)) continue
                seen.add(wallKey)
                result.push(wall)
            }
        }
        return result
    })

    // The real wall(s) that used to bound the region right where a not-yet-confirmed
    // expansion pick borders it - about to become interior once the expansion is
    // actually applied (see ExpandRegion.apply's removeInteriorWalls), but a real
    // WallSegment there right now would still visually cut the picked space off from
    // the rest of the region. Suppressed from the real-walls render below so the pick
    // reads as already merged in, matching expansionPreviewWalls' own treatment of the
    // OTHER (still-exterior) edges.
    const expansionHiddenWallKeys = $derived.by(() => {
        if (!expandStageActive || gameSession.expansionSquares.length === 0) return new Set<string>()
        const region = gameSession.gameState.regions.find((r) => r.id === gameSession.selectedExpandRegionId)
        if (!region) return new Set<string>()

        const claimed = new Set(region.squareKeys)
        for (const s of gameSession.expansionSquares) claimed.add(squareKey(s.col, s.row))

        const hidden = new Set<string>()
        for (const space of gameSession.expansionSquares) {
            for (const n of neighbors(space.col, space.row)) {
                if (!isOnBoard(n.col, n.row)) continue
                if (!claimed.has(squareKey(n.col, n.row))) continue
                const wall = wallBetween(space.col, space.row, n.col, n.row)
                if (!wall) continue
                hidden.add(`${wall.col},${wall.row},${wall.edge}`)
            }
        }
        return hidden
    })

    // Flat-color fallback, only used for squares when the board has no tileLayout
    // (older boards assembled before real tile art was wired up) - otherwise the
    // actual board-a..f.jpg tile art (rendered behind the grid) shows through instead.
    const terrainBg: Record<SquareType, string> = {
        [SquareType.Blank]: '#e7dfc9',
        [SquareType.Forest]: '#4c7a3d',
        [SquareType.Hill]: '#9a6b3a',
        [SquareType.Village]: '#a63b3b'
    }

    function isSelected(col: number, row: number): boolean {
        const sel = gameSession.selectedCastleSquare
        return sel !== undefined && sel.col === col && sel.row === row
    }

    // Only the knight squares that would actually be legal for the selected castle -
    // not just any adjacent square - so the highlight matches what's clickable.
    function isLegalKnightSquare(col: number, row: number): boolean {
        const sel = gameSession.selectedCastleSquare
        if (!sel) return false
        return HydratedPlaceCastle.isValidKnightSquare(gameSession.gameState, sel.col, sel.row, col, row)
    }

    // Opening placement says what CANNOT be used rather than animating what can: a scrim over
    // every illegal square, leaving the legal ones reading as ordinary board. Both halves of the
    // two-click flow are covered - castle squares first, then the knight squares around the one
    // just picked.
    //
    // canPlaceCastle stays true across both halves because picking a castle square is local UI
    // state, not a game action, so the selection is what tells the two apart.
    // Which square the mouse is over, for the opening castle preview. Tracked on the square
    // buttons rather than the grid container: a div with a mouse handler wants an ARIA role, and
    // giving the board a half-built grid role would be worse for a screen reader than leaving the
    // buttons to speak for themselves.
    let hoveredSquare: { col: number; row: number } | undefined = $state(undefined)

    // A castle drawn under the cursor on a square that would take it. One square at a time, and
    // only before a castle square is picked - once one is, the question has moved on to its
    // knight.
    function isCastlePreviewSquare(col: number, row: number): boolean {
        if (!gameSession.canPlaceCastle || gameSession.selectedCastleSquare) return false
        if (hoveredSquare?.col !== col || hoveredSquare?.row !== row) return false
        return isLegalCastleSquare(col, row)
    }

    // The knight that would land here, drawn under the cursor exactly as the castle is. Covers
    // every knight the board ever asks for - the one beside a castle during setup, a knight in
    // regular play, and Renegade's replacement - because it defers to showsLegalHighlight for
    // "would this square take the piece being placed", which already knows all three.
    //
    // The castle preview wins where both could apply: during the castle stage showsLegalHighlight
    // is listing castle squares, and a knight drawn on one would be answering a question nobody
    // asked yet.
    function isKnightPreviewSquare(col: number, row: number): boolean {
        if (isCastlePreviewSquare(col, row)) return false
        if (hoveredSquare?.col !== col || hoveredSquare?.row !== row) return false
        return showsLegalHighlight(col, row)
    }

    // How opening placement tells the player where a piece may go. Three treatments, all kept,
    // because which one reads best is a question for the eye rather than the code:
    //
    //   'legal' - the squares that WILL work, tinted in the placing colour with a matching
    //             border. Positive marking: the only one of the three that says yes.
    //   'gray'  - a scrim over every square that will not.
    //   'x'     - a red X in each square that will not.
    //
    // The two negative treatments were tried first, in that order.
    const PLACEMENT_HINT: 'legal' | 'gray' | 'x' = 'legal'

    // Illegal for the click being asked for right now, whichever mark is in use. Non-plains is
    // excluded here because terrain is a hard precondition the engine applies to the castle square
    // AND its knight, so a forest, hill or village was never in the running and saying so is
    // noise.
    function isIllegalPlacementSpot(col: number, row: number): boolean {
        if (!gameSession.canPlaceCastle) return false

        const square = board.squares[row]?.[col]
        if (square?.type !== SquareType.Blank) return false

        return gameSession.selectedCastleSquare
            ? !isLegalKnightSquare(col, row)
            : !isLegalCastleSquare(col, row)
    }

    // A scrim can go anywhere the rule applies: it dims a square rather than adding to it, so it
    // covers both halves of the flow and dims a piece along with its square.
    function showsIllegalScrim(col: number, row: number): boolean {
        return PLACEMENT_HINT === 'gray' && isIllegalPlacementSpot(col, row)
    }

    // The positive treatment: the squares the current click would actually accept, marked with a
    // dot. Every placement question the board asks now answers it the same way - opening castles,
    // the knight beside one, a knight in regular play, and Renegade's replacement knight.
    //
    // The knight cases used to fade a ghost knight in and out on each legal square instead. A dot
    // says the same thing without moving, and one visual language across every placement beats two.
    function showsLegalHighlight(col: number, row: number): boolean {
        if (PLACEMENT_HINT !== 'legal') return false

        // Setup: the castle squares, then the knight squares around the one just picked.
        if (gameSession.canPlaceCastle) {
            return gameSession.selectedCastleSquare
                ? isLegalKnightSquare(col, row)
                : isLegalCastleSquare(col, row)
        }

        if (knightStageActive && isLegalKnightPlacement(col, row)) return true
        return isLegalRenegadePlacementSquare(col, row)
    }

    // Whose colour the dot is drawn in. placementColor covers setup, where a closing lap places the
    // neutral prince's castle rather than the player's own; outside setup it is undefined and the
    // piece being placed is simply mine.
    const legalHintColor = $derived(placementColor ?? myColor)

    // The X cannot go everywhere the scrim can, which is a property of the mark rather than of the
    // rule:
    //   - Not during the knight stage. At most four squares are legal there, so an X would land on
    //     nearly every plains square and measle the map. Dimming that many is fine; marking them
    //     is not.
    //   - Not on an occupied square. The piece already says "taken", and a glyph would either hide
    //     under it or deface it - where a scrim simply dims both together.
    function showsIllegalX(col: number, row: number): boolean {
        if (PLACEMENT_HINT !== 'x') return false
        if (gameSession.selectedCastleSquare) return false

        const square = board.squares[row]?.[col]
        if (square?.castleColor || square?.knightColor) return false

        return isIllegalPlacementSpot(col, row)
    }

    function isLegalCastleSquare(col: number, row: number): boolean {
        return legalCastleSquareSet.has(`${col},${row}`)
    }

    // Regular-play knight placement (distinct from isLegalKnightSquare, which is for
    // the setup-phase castle+knight two-click flow).
    function isLegalKnightPlacement(col: number, row: number): boolean {
        return legalKnightSquareSet.has(`${col},${row}`)
    }

    function isLegalExpansionSquare(col: number, row: number): boolean {
        return legalExpansionSquareSet.has(`${col},${row}`)
    }

    function isOwnSelectableRegion(col: number, row: number): boolean {
        if (gameSession.selectedExpandRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && myRegionIdSet.has(region.id)
    }

    // Same, but for the expansion flow specifically, which can't offer every region of
    // yours while one expansion is already under way (see expandableRegions).
    function isSelectableExpandRegion(col: number, row: number): boolean {
        if (gameSession.selectedExpandRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && expandableRegionIdSet.has(region.id)
    }

    function regionAt(col: number, row: number) {
        return regionBySquareKey.get(squareKey(col, row))
    }

    function isOwnSelectableRenegadeRegion(col: number, row: number): boolean {
        if (!gameSession.isPlayingRenegadeCard || gameSession.renegadeOwnRegionId) return false
        if (!isOwnSelectableRegion(col, row)) return false
        const region = regionAt(col, row)
        return region !== undefined && legalRenegadeOwnRegionIdSet.has(region.id)
    }

    function isSelectableRenegadeEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.renegadeOwnRegionId || gameSession.renegadeEnemyRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalRenegadeEnemyRegionIds.has(region.id)
    }

    function isLegalRenegadeRemovableSquare(col: number, row: number): boolean {
        return !gameSession.renegadeRemovedSquare && legalRenegadeRemovableSquareSet.has(`${col},${row}`)
    }

    function isRenegadeRemovedSquare(col: number, row: number): boolean {
        const sel = gameSession.renegadeRemovedSquare
        return sel !== undefined && sel.col === col && sel.row === row
    }

    function isLegalRenegadePlacementSquare(col: number, row: number): boolean {
        return legalRenegadePlacementSquareSet.has(`${col},${row}`)
    }

    function isOwnSelectableAllianceRegion(col: number, row: number): boolean {
        if (!gameSession.isPlayingAllianceCard || gameSession.allianceOwnRegionId) return false
        if (!isOwnSelectableRegion(col, row)) return false
        // Only regions that actually have something to ally with (see
        // legalAllianceOwnRegionIds) - a dead-end region isn't clickable at all.
        const region = regionAt(col, row)
        return region !== undefined && legalAllianceOwnRegionIdSet.has(region.id)
    }

    function isSelectableAllianceEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.allianceOwnRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalAllianceEnemyRegionIds.has(region.id)
    }

    // A faint tint in the owning prince's color over any square claimed by a region, so
    // newly-created regions are visible at a glance. A neutral zone gets no tint at all:
    // it isn't anybody's, and the walls around it already show it's a zone. (It used to
    // be painted #888888 - which is precisely the gray prince's own color, so an
    // unclaimed zone read as that player's territory, most alarmingly right after an
    // invasion cut one loose.) So: tinted means owned, untinted means unowned.
    function regionTint(col: number, row: number): string | undefined {
        const key = squareKey(col, row)

        // A space picked for the region-in-progress (not yet confirmed/dispatched)
        // reads as already part of the region, tinted the same as the rest of it -
        // rather than a separate "pending" ring - since the walls around it are drawn
        // the same way too (see expansionPreviewWalls).
        if (expandStageActive && gameSession.expansionSquares.some((s) => s.col === col && s.row === row)) {
            const region = regions.find((r) => r.id === gameSession.selectedExpandRegionId)
            if (region?.ownerColor) return gameSession.colors.getUiColor(region.ownerColor)
        }

        const region = regionBySquareKey.get(key)
        if (!region?.ownerColor) return undefined
        return gameSession.colors.getUiColor(region.ownerColor)
    }

    async function onSquareClick(col: number, row: number) {
        if (gameSession.isPlayingAllianceCard) {
            if (!gameSession.allianceOwnRegionId) {
                if (isOwnSelectableAllianceRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectAllianceOwnRegion(region.id)
                }
                return
            }
            if (isSelectableAllianceEnemyRegion(col, row)) {
                const region = regionAt(col, row)
                if (region) await gameSession.selectAllianceEnemyRegion(region.id)
            }
            return
        }

        if (gameSession.isPlayingRenegadeCard) {
            if (!gameSession.renegadeOwnRegionId) {
                if (isOwnSelectableRenegadeRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectRenegadeOwnRegion(region.id)
                }
                return
            }
            if (!gameSession.renegadeEnemyRegionId) {
                if (isSelectableRenegadeEnemyRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectRenegadeEnemyRegion(region.id)
                }
                return
            }
            if (!gameSession.renegadeRemovedSquare) {
                if (isLegalRenegadeRemovableSquare(col, row)) {
                    gameSession.selectRenegadeRemovedSquare(col, row)
                }
                return
            }
            if (isLegalRenegadePlacementSquare(col, row)) {
                await gameSession.confirmRenegadePlacement(col, row)
            }
            return
        }

        if (gameSession.selectedCastleSquare) {
            // Ignored too, for consistency within one flow - and because reporting it used to
            // clear the selection, so a stray click took the castle back off the board. The ring
            // marks the squares that will work, and Undo releases the castle.
            if (isLegalKnightSquare(col, row)) {
                await gameSession.placeCastleWithKnight(col, row)
            }
            return
        }

        if (gameSession.canPlaceCastle) {
            // Ignored rather than explained: the X on the square has already said why, and an
            // error dialog for a click the board visibly refused is nagging.
            if (isLegalCastleSquare(col, row)) {
                gameSession.selectCastleSquare(col, row)
            }
            return
        }

        if (expandStageActive) {
            if (!gameSession.selectedExpandRegionId) {
                if (isSelectableExpandRegion(col, row)) {
                    const key = squareKey(col, row)
                    const region = gameSession.expandableRegions.find((r) => r.squareKeys.includes(key))
                    if (region) gameSession.selectRegionToExpand(region.id)
                }
                return
            }
            if (isLegalExpansionSquare(col, row)) {
                await gameSession.addExpansionSquare(col, row)
                return
            }
            // Under an expand-then-knight plan the knight is live alongside the
            // expansion's optional 2nd space, and placing it is what ends the expansion
            // early - the only way to stop at one space now that there's no Done button.
            // Expanding wins on a square that would serve either purpose (it's the stage
            // the plan says comes first); Undo covers a misclick.
            if (knightStageActive && isLegalKnightPlacement(col, row)) {
                await gameSession.placeKnight(col, row)
            }
            return
        }

        // Deliberately not gated on isLegalKnightPlacement - placeKnight reports exactly
        // why an illegal square was rejected, which is more useful than a dead click.
        if (knightStageActive) {
            await gameSession.placeKnight(col, row)
        }
    }

    // The frame-offset reporting that used to live here is gone with the text it existed for.
    // It measured how far the board frame sat below this component's top edge, so Board.svelte
    // could pad the deck column down by the same amount and keep their tops level - the status
    // text above the frame grew and shrank with game state, so it was never a fixed number.
    //
    // That text is now rendered by GameTable outside ScalingWrapper, so the frame is this
    // component's first row and the offset is zero by construction. A ResizeObserver, a
    // scale-correction and a prop all disappear with it.
</script>

{#snippet pieceIcon(fillSrc: string, linesSrc: string, color: Color, offsetY: number = 0)}
    <!-- fillSrc is a black silhouette used as a mask so background-color (the exact
         player color, boosted a bit via filter below) shows through only inside the
         shape; linesSrc is the same artwork's outline/detail work (transparent
         everywhere else) layered on top, so it stays crisp regardless of fill color.
         offsetY nudges the knight artwork up 1px to match how it actually sits on the
         tile art - castles don't need it. A soft white glow (drop-shadow follows the
         piece's own silhouette, not a box) helps darker knight colors stay visible
         against busy forest tiles. -->
    <div
        class="absolute inset-[3px]"
        style="
            {offsetY ? `transform: translateY(${offsetY}px);` : ''}
            filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.8));
        "
    >
        <div
            class="absolute inset-0"
            style="
                background-color:{gameSession.colors.getUiColor(color)};
                mask-image:url({fillSrc}); mask-size:contain; mask-repeat:no-repeat; mask-position:center;
                -webkit-mask-image:url({fillSrc}); -webkit-mask-size:contain; -webkit-mask-repeat:no-repeat; -webkit-mask-position:center;
                filter: saturate(1.5) brightness(1.15);
            "
        ></div>
        <img src={linesSrc} alt="" class="absolute inset-0 w-full h-full object-contain" />
    </div>
{/snippet}

{#snippet ducatMedallion()}
    <!-- The same embossed-parchment coin the player panels mint their ducat count on
         (see PlayerState's tintedIcon), reused here so a price on the board reads in the
         game's own currency iconography. Tinted in my own color - it's my money. -->
    <div
        class="absolute inset-0 rounded-full"
        style="
            background: radial-gradient(circle at 38% 30%, #fdfaf0 0%, #efe6d0 58%, #d3c3a0 100%);
            border: 1px solid rgba(94, 73, 42, 0.5);
            box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.75), 0 1px 2px rgba(0, 0, 0, 0.4);
        "
    ></div>
    <div class="absolute inset-[16%]" style="filter: drop-shadow(0 0.5px 1px rgba(0, 0, 0, 0.45));">
        <div
            class="absolute inset-0"
            style="
                background-color:{myColor ? gameSession.colors.getUiColor(myColor) : '#d4af37'};
                mask-image:url({iconMoneybagFill}); mask-size:contain; mask-repeat:no-repeat; mask-position:center;
                -webkit-mask-image:url({iconMoneybagFill}); -webkit-mask-size:contain; -webkit-mask-repeat:no-repeat; -webkit-mask-position:center;
                filter: saturate(1.7) brightness(1.18);
            "
        ></div>
        <img src={iconMoneybagLines} alt="" class="absolute inset-0 w-full h-full object-contain" />
    </div>
{/snippet}

<div class="flex flex-col gap-2 items-center">

    <!-- A hand-hewn castle-wall frame (see RampartBorder/RampartCorner) around the
         actual board content, sized in a 3x3 grid so the border strips stretch to
         exactly match the board's own width/height. -->
    <!-- The id is how things outside this component find the board's real position on
         screen - currently the region-scoring aid, which centers itself on the frame (see
         ActionToolbar). -->
    <div
        id="lowenherz-board-frame"
        class="grid drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
        style="grid-template-columns: 20px {boardWidthPx}px 20px; grid-template-rows: 20px {boardHeightPx}px 20px; width: fit-content;"
    >
        <RampartCorner />
        <div><RampartBorder side="top" /></div>
        <RampartCorner />

        <div><RampartBorder side="left" /></div>
        <div
            class="relative"
            style="width: fit-content;"
            role="presentation"
            onmousemove={(e) => {
                hoverPoint = boardPointFromEvent(e.currentTarget, e.clientX, e.clientY)
            }}
            onmouseleave={() => (hoverPoint = undefined)}
        >
        {#if tileLayout.length > 0}
            <!-- The 6 physical board tiles, positioned and rotated exactly as this game
                 assembled them - sits behind the clickable square grid below. -->
            <!-- Negative z-index (not a lower positive one) so this stays behind the
                 grid below without needing to move the grid into the positioned
                 stacking layer itself - the grid must stay a plain static element so
                 the wall bars/click-targets (painted after it, unpositioned-relative
                 z-auto) keep rendering on top of it, exactly as before this change. -->
            <div
                class="absolute overflow-hidden pointer-events-none -z-10"
                style="top:1px; left:1px; width:{board.squares[0].length * CELL_SIZE}px; height:{board.squares
                    .length * CELL_SIZE}px;"
            >
                {#each tileLayout as tile (tile.tileCol + ',' + tile.tileRow)}
                    <img
                        src={tileImages[tile.tileId]}
                        alt=""
                        class="absolute"
                        style="
                            left: {tile.tileCol * TILE_PX}px;
                            top: {tile.tileRow * TILE_PX}px;
                            width: {TILE_PX}px;
                            height: {TILE_PX}px;
                            transform: rotate({tile.rotation}deg);
                        "
                    />
                {/each}
            </div>
        {/if}
        <div
            class="grid border-2 border-black/60"
            style="grid-template-columns: repeat({board.squares[0].length}, {CELL_SIZE}px);"
        >
            {#each board.squares as rowSquares, row (row)}
                {#each rowSquares as square, col (col)}
                    {@const tint = regionTint(col, row)}
                    <button
                        type="button"
                        onclick={() => onSquareClick(col, row)}
                        onmouseenter={() => (hoveredSquare = { col, row })}
                        onmouseleave={() => {
                            // Guarded so that moving between two squares cannot blank the
                            // preview: leaving A clears only while A is still the hovered one, and
                            // entering B has already overwritten it by then.
                            if (hoveredSquare?.col === col && hoveredSquare?.row === row) {
                                hoveredSquare = undefined
                            }
                        }}
                        class="relative flex items-center justify-center border border-black/20 {isSelected(col, row) ? 'ring-4 ring-yellow-300 z-10' : ''} {isLegalKnightSquare(col, row) && PLACEMENT_HINT !== 'legal' ? 'ring-2 ring-yellow-100' : ''}"
                        style="width:{CELL_SIZE}px; height:{CELL_SIZE}px; {tileLayout.length > 0 ? '' : `background-color:${terrainBg[square.type]};`}"
                    >
                        {#if tint}
                            {@const pulsing =
                                (expandStageActive && isSelectableExpandRegion(col, row)) ||
                                isOwnSelectableRenegadeRegion(col, row) ||
                                isOwnSelectableAllianceRegion(col, row) ||
                                isSelectableRenegadeEnemyRegion(col, row) ||
                                isSelectableAllianceEnemyRegion(col, row)}
                            <!-- Same region tint as always, but pulsing (rather than a ring
                                 around the square) while it's a region the player could
                                 currently pick - their own, to expand it or as the starting
                                 region for a Renegade/Alliance card, or a bordering enemy
                                 region to target with one. -->
                            <span
                                class="absolute inset-0 pointer-events-none {pulsing ? 'region-expand-pulse' : ''}"
                                style="background-color:{tint}; {pulsing ? '' : 'opacity:0.385;'}"
                            ></span>
                        {/if}
                        {#if isCastlePreviewSquare(col, row) && placementColor}
                            <!-- The castle that would go here, under the cursor. Static rather
                                 than pulsing: it is answering "this one?", and one square at a
                                 time needs no animation to be noticed. Own colour for the opening
                                 laps and the NEUTRAL colour for the closing ones, since those
                                 castles belong to the third prince. -->
                            <div class="absolute inset-0 pointer-events-none opacity-60">
                                {@render pieceIcon(castleFill, castleLines, placementColor)}
                            </div>
                        {/if}
                        {#if isKnightPreviewSquare(col, row) && legalHintColor}
                            <!-- The knight that would land here, same treatment as the castle. -->
                            <div class="absolute inset-0 pointer-events-none opacity-60">
                                {@render pieceIcon(knightFill, knightLines, legalHintColor, -1)}
                            </div>
                        {/if}
                        <!-- The dot is suppressed under either preview: the piece drawn there
                             already says the square will take one, and a dot beside it is the same
                             claim twice. -->
                        {#if showsLegalHighlight(col, row) && !isCastlePreviewSquare(col, row) && !isKnightPreviewSquare(col, row) && legalHintColor}
                            {@const hintColor = gameSession.colors.getUiColor(legalHintColor)}
                            <!-- A filled disc, about a third of the square. r 1.85 of the
                                 ten-unit viewBox is a 3.7-unit diameter - the same outer edge the
                                 stroked ring had, so "filled in" means exactly that rather than
                                 also changing size.
                                 
                                 Expressed as a fill with no stroke rather than a fill plus the old
                                 stroke: one property doing one job, and nothing to keep in step if
                                 the size changes again. The svg still fills the cell, so the
                                 geometry carries the size and there is no scaling to distort.
                                 
                                 In the PLACING colour, so the closing laps mark the neutral
                                 prince's spots in the neutral colour rather than claiming them
                                 for whoever is placing. -->
                            <svg
                                viewBox="0 0 10 10"
                                class="absolute inset-0 w-full h-full pointer-events-none"
                                aria-hidden="true"
                            >
                                <!-- The same boost AND the same soft white glow pieceIcon puts on a
                                     castle or a knight, so the dot is the colour of the piece it
                                     stands for
                                     rather than of the raw palette entry. getUiColor's yellow is
                                     #d4af37, but no castle is ever drawn in it - which is why the
                                     dot looked like a different yellow from the pieces. Matched by
                                     construction, so all four colours track their own pieces.
                                     
                                     A dark rim rather than a brighter hue. Brightening the yellow
                                     made it legible on the forests and then invisible on the
                                     plains, which is the shape of the real problem: the dot has to
                                     read against light parchment AND dark green, and no single
                                     colour does both. An outline is terrain-independent, and it
                                     fixes all four colours at once instead of one per complaint. -->
                                <circle
                                    cx="5"
                                    cy="5"
                                    r="1.85"
                                    fill={hintColor}
                                    stroke="#000000"
                                    stroke-opacity="0.55"
                                    stroke-width="0.16"
                                    opacity="0.7"
                                    style="filter: saturate(1.5) brightness(1.15)
                                        drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.9))
                                        drop-shadow(0 0 3px rgba(255, 255, 255, 0.8));"
                                />
                            </svg>

                        {/if}
                        {#if showsIllegalScrim(col, row)}
                            <!-- Drawn after the region tint but before the pieces, so a piece
                                 standing on a dimmed square is dimmed WITH it rather than painted
                                 over. -->
                            <span class="absolute inset-0 pointer-events-none bg-black/40"></span>
                        {/if}
                        {#if showsIllegalX(col, row)}
                            <!-- Small, centred, and the only thing on the square: showsIllegalX
                                 has already excluded every square that holds a piece, so there is
                                 nothing here to obscure. -->
                            <span
                                class="absolute inset-0 pointer-events-none flex items-center justify-center"
                            >
                                <!-- The X spans ~90% of the square: the svg fills the cell and
                                     the stroke runs corner to corner inset by half a unit of the
                                     ten-unit viewBox.
                                     
                                     stroke-width is in viewBox units, so it grows with the square
                                     - 0.6 of 10 across a 44px cell is about 2.6px. That matters
                                     because the width was tuned against a much smaller mark:
                                     keeping the old 1.9 here would have drawn a line over 8px
                                     thick, a red barrier rather than a red X. -->
                                <svg viewBox="0 0 10 10" class="w-full h-full opacity-70" aria-hidden="true">
                                    <path
                                        d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5"
                                        stroke="#b0201a"
                                        stroke-width="0.6"
                                        stroke-linecap="round"
                                        fill="none"
                                    />
                                </svg>
                            </span>
                        {/if}
                        {#if square.castleColor}
                            {@render pieceIcon(castleFill, castleLines, square.castleColor)}
                        {:else if isSelected(col, row) && placementColor}
                            <!-- The castle isn't actually placed yet (still needs its adjacent
                                 knight square picked), but it reads as solid and settled here.
                                 Same own-then-neutral colour as the hover preview.
                                 
                                 Deliberately not animated. A hop on landing was tried and read as
                                 forced: the hover preview already shows the castle on the square
                                 before the click, so the click has nothing left to announce - it
                                 only has to stop looking like a preview. -->
                            {@render pieceIcon(castleFill, castleLines, placementColor)}
                        {:else if square.knightColor}
                            {#if isRenegadeRemovedSquare(col, row)}
                                <!-- The knight the player just clicked to remove - simply
                                     vanishes from view, same as it always has, rather than
                                     staying rendered with some marker on top of it. It isn't
                                     actually gone from game state until the whole Renegade
                                     play is confirmed, but this square shouldn't look occupied
                                     in the meantime. -->
                            {:else if isRenegadeArrivalSquare(col, row)}
                                <!-- Held back until the defecting knight actually lands on
                                     it - see renegadeFlight. -->
                            {:else if isLegalRenegadeRemovableSquare(col, row)}
                                <!-- The real knight already there, pulsing in place - rather than
                                     a ring around it - to show it's a legal removal target. -->
                                <div class="absolute inset-0 ghost-knight-pulse pointer-events-none">
                                    {@render pieceIcon(knightFill, knightLines, square.knightColor, -1)}
                                </div>
                            {:else}
                                {@render pieceIcon(knightFill, knightLines, square.knightColor, -1)}
                            {/if}
                        {/if}
                    </button>
                {/each}
            {/each}
        </div>

        <!-- Boundary walls: crenellated bars (see WallSegment) anchored at the
             wall's starting corner - west edges run down from there, north edges run
             right, so two segments sharing a grid corner always anchor at the same
             pixel point and their end-squares overlap. -->
        {#each board.walls as wall (wall.col + ',' + wall.row + ',' + wall.edge)}
            {#if !expansionHiddenWallKeys.has(`${wall.col},${wall.row},${wall.edge}`)}
                {@const junctions = wallJunctionVisibility(wall)}
                <div
                    class="absolute pointer-events-none"
                    style="left: {wall.col * CELL_SIZE}px; top: {wall.row * CELL_SIZE}px;"
                >
                    <WallSegment
                        orientation={wall.edge === 'west' ? 'vertical' : 'horizontal'}
                        hideStartJunction={junctions.hideStart}
                        hideEndJunction={junctions.hideEnd}
                    />
                </div>
            {/if}
        {/each}

        <!-- Preview walls around a not-yet-confirmed expansion pick - same look as
             real walls, just slightly transparent, since they aren't real yet. -->
        {#each expansionPreviewWalls as wall (wall.col + ',' + wall.row + ',' + wall.edge + '-preview')}
            {@const junctions = wallJunctionVisibility(wall)}
            <div
                class="absolute pointer-events-none"
                style="left: {wall.col * CELL_SIZE}px; top: {wall.row * CELL_SIZE}px; opacity: 0.85;"
            >
                <WallSegment
                    orientation={wall.edge === 'west' ? 'vertical' : 'horizontal'}
                    hideStartJunction={junctions.hideStart}
                    hideEndJunction={junctions.hideEnd}
                />
            </div>
        {/each}

        <!-- Alliance markers: a small heart on every boundary wall between two allied
             regions - the only on-board sign an alliance exists, and (when I'm a
             participant who can afford the 10 ducats) the control for ending it. -->
        {#each allianceMarkers as marker (marker.id)}
            {@const previewing = hoveredAllianceId === marker.id}

            <!-- No ghost-wall restoration here any more. The rulebook marks an alliance by
                 turning one shared wall 90 degrees, and cancelling puts it back in line -
                 but this board draws allied walls flush at all times and shows the alliance
                 with hearts instead, so animating a wall "back" into an orientation it
                 already has was undoing something the player had never seen. The hover
                 preview is now the hearts themselves. -->
            {#each marker.walls as wall (wall.col + ',' + wall.row + ',' + wall.edge + '-heart')}
                {@const { left, top } = heartPosition(wall)}
                {#if marker.cancellable}
                    <!-- A heart's own idle animation is a heartbeat, which is exactly the
                         "alive, touchable" cue this needs - it beats only while cancelling
                         is actually open to this player, and sits dead still otherwise.
                         The words live in aria-label rather than on screen. -->
                    <button
                        type="button"
                        aria-label={allianceCancelLabel(marker)}
                        title={allianceCancelLabel(marker)}
                        class="absolute flex items-center justify-center z-40 cursor-pointer rounded-full {previewing
                            ? ''
                            : 'alliance-heartbeat'}"
                        style="left: {left}px; top: {top}px; width: 24px; height: 24px; font-size: 19px;"
                        onmouseenter={() => (hoveredAllianceId = marker.id)}
                        onmouseleave={() => (hoveredAllianceId = undefined)}
                        onfocus={() => (hoveredAllianceId = marker.id)}
                        onblur={() => (hoveredAllianceId = undefined)}
                        onclick={(e) => {
                            e.stopPropagation()
                            hoveredAllianceId = undefined
                            gameSession.cancelAlliance(marker.id)
                        }}
                    >
                        <!-- Ducat-gold ring, so the beating heart reads as costing money
                             rather than as decoration. -->
                        <span
                            class="absolute inset-0 rounded-full pointer-events-none"
                            style="border: 1.5px solid rgba(217, 180, 74, {previewing
                                ? 1
                                : 0.85}); box-shadow: 0 0 6px rgba(217, 180, 74, 0.55);"
                        ></span>
                        <!-- The shiver is on the glyph, not the button, so the gold ring
                             stays put and the heart trembles inside it. -->
                        <span class="relative leading-none {previewing ? 'alliance-heart-shiver' : ''}"
                            >{previewing ? '💔' : '🩷'}</span
                        >
                    </button>
                {:else}
                    <div
                        class="absolute pointer-events-none flex items-center justify-center z-40"
                        style="left: {left}px; top: {top}px; width: 24px; height: 24px; font-size: 19px;"
                    >
                        🩷
                    </div>
                {/if}
            {/each}

            <!-- The price, shown once per alliance (on its first heart) while previewing -
                 the same minted-ducat medallion the player panels use, so the cost reads
                 in the game's own currency iconography instead of a sentence. -->
            {#if previewing}
                {@const wall = marker.walls[0]}
                <div
                    class="absolute pointer-events-none z-50 flex items-center gap-0.5 alliance-price-rise"
                    style="
                        left: {(wall.edge === 'west'
                        ? wall.col * CELL_SIZE
                        : wall.col * CELL_SIZE + CELL_SIZE / 2) + 12}px;
                        top: {(wall.edge === 'west'
                        ? wall.row * CELL_SIZE + CELL_SIZE / 2
                        : wall.row * CELL_SIZE) - 30}px;
                    "
                >
                    <span
                        class="text-[14px] font-bold leading-none"
                        style="color: #7a2e2e; text-shadow: 0 1px 0 rgba(255,255,255,0.8);"
                    >
                        −{ALLIANCE_CANCELLATION_COST}
                    </span>
                    <span class="relative w-[20px] h-[20px] shrink-0">
                        {@render ducatMedallion()}
                    </span>
                </div>
            {/if}
        {/each}

        <!-- Village names, in the overlay layer rather than inside each square button: a
             pill is wider than its square and has to be able to spill over its neighbours,
             which needs a shared stacking context to sit above them all. They're always
             rendered and merely transparent, so the opacity transition can play in BOTH
             directions - mounting them on hover would fade in but vanish on the way out. -->
        {#each villages as village (village.col + ',' + village.row)}
            <div
                class="absolute pointer-events-none z-40 village-name {hoveringVillage
                    ? 'village-name-shown'
                    : ''}"
                style="left: {village.col * CELL_SIZE + CELL_SIZE / 2}px; top: {village.row *
                    CELL_SIZE +
                    CELL_SIZE / 2}px;"
            >
                {village.name}
            </div>
        {/each}

        <!-- The defecting knight in flight. Two copies of the same piece stacked - the old
             owner's colour fading out, the new owner's fading in - so the change of side
             happens over the arc rather than as a swap at either end. -->
        {#if renegadeFlight}
            {#key renegadeFlight.id}
                <div
                    class="absolute pointer-events-none z-50 renegade-flight"
                    style="
                        left: {renegadeFlight.left}px;
                        top: {renegadeFlight.top}px;
                        width: {CELL_SIZE}px;
                        height: {CELL_SIZE}px;
                        --renegade-dx: {renegadeFlight.dx}px;
                        --renegade-dy: {renegadeFlight.dy}px;
                    "
                >
                    <div class="absolute inset-0 renegade-flight-old">
                        {@render pieceIcon(knightFill, knightLines, renegadeFlight.fromColor, -1)}
                    </div>
                    <div class="absolute inset-0 renegade-flight-new">
                        {@render pieceIcon(knightFill, knightLines, renegadeFlight.toColor, -1)}
                    </div>
                </div>
            {/key}
        {/if}

        <!-- The alliance breaking. Rendered outside the allianceMarkers loop on purpose:
             by the time this plays the alliance is gone from state, so there is no marker
             left to hang it on - the positions come from lastKnownAllianceWalls. One burst
             per wall that carried a heart, so a long shared border comes apart along its
             whole length rather than in one spot. -->
        {#each allianceBursts as burst (burst.id)}
            <div
                class="absolute pointer-events-none z-50"
                style="left: {burst.left}px; top: {burst.top}px; width: 24px; height: 24px;"
            >
                <span
                    class="absolute inset-0 flex items-center justify-center alliance-burst-core"
                    style="font-size: 19px;"
                >
                    💔
                </span>
                {#each BURST_SHARD_ANGLES as angle, i (i)}
                    <span
                        class="absolute inset-0 flex items-center justify-center alliance-burst-shard"
                        style="--shard-angle: {angle}deg; animation-delay: {i * 9}ms;"
                    >
                        🩷
                    </span>
                {/each}
            </div>
        {/each}

        <!-- A single pulsing preview of the wall that would actually be placed at
             whichever legal spot is nearest the mouse - rather than glowing every
             legal spot at once. Shows nothing while the mouse isn't over the board
             (hoverPoint unset) or over a state with no legal walls at all. -->
        {#if ghostWall}
            {@const junctions = wallJunctionVisibility(ghostWall)}
            <div
                class="absolute pointer-events-none z-20 ghost-wall-pulse"
                style="left: {ghostWall.col * CELL_SIZE}px; top: {ghostWall.row * CELL_SIZE}px;"
            >
                <WallSegment
                    orientation={ghostWall.edge === 'west' ? 'vertical' : 'horizontal'}
                    hideStartJunction={junctions.hideStart}
                    hideEndJunction={junctions.hideEnd}
                />
            </div>
        {/if}

        <!-- One bouncing arrow per legal expansion direction, centered on the wall it
             would cross, pointing toward the space it would claim - in the expanding
             player's own color. The rotation (to actually face the right direction)
             has to sit on this outer element, un-animated, since it varies per arrow -
             the bounce lives on the inner wrapper below, moving along the arrow's own
             "up" axis so it ends up bouncing the right way once rotated. -->
        {#each expansionArrows as arrow (arrow.key)}
            <div
                class="absolute pointer-events-none z-[25]"
                style="
                    left: {(arrow.wall.edge === 'west'
                    ? arrow.wall.col * CELL_SIZE
                    : arrow.wall.col * CELL_SIZE + CELL_SIZE / 2) - 12}px;
                    top: {(arrow.wall.edge === 'west'
                    ? arrow.wall.row * CELL_SIZE + CELL_SIZE / 2
                    : arrow.wall.row * CELL_SIZE) - 12}px;
                    width: 24px;
                    height: 24px;
                    color: {myColor ? gameSession.colors.getUiColor(myColor) : '#ffffff'};
                    transform: rotate({ARROW_ROTATION[arrow.direction]}deg);
                "
            >
                <div class="expansion-arrow-bounce">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M12 3 L21 18 L3 18 Z" stroke="black" stroke-width="1" stroke-linejoin="round" />
                    </svg>
                </div>
            </div>
        {/each}

        <!-- Clickable lines for legal wall placements - one click directly on the
             boundary between two squares places the wall there. Invisible - the
             ghost wall above is the only visual cue - but every legal edge stays
             independently clickable, not just whichever one is currently ghosted. -->
        {#each legalWallEdges as edge (edge.col1 + ',' + edge.row1 + '-' + edge.col2 + ',' + edge.row2)}
            {@const sameRow = edge.row1 === edge.row2}
            <button
                type="button"
                aria-label="Place wall"
                class="absolute z-30 cursor-pointer"
                style="
                    left: {sameRow ? edge.col2 * CELL_SIZE - 8 : edge.col1 * CELL_SIZE}px;
                    top: {sameRow ? edge.row1 * CELL_SIZE : edge.row2 * CELL_SIZE - 8}px;
                    width: {sameRow ? 16 : CELL_SIZE}px;
                    height: {sameRow ? CELL_SIZE : 16}px;
                "
                onclick={() => gameSession.placeWallBetween(edge.col1, edge.row1, edge.col2, edge.row2)}
            ></button>
        {/each}

        <!-- Floating score-change popups - see addPopup/floatPopup above -->
        {#each popups as popup (popup.id)}
            <div
                {@attach floatPopup(popup.id)}
                class="absolute z-50 pointer-events-none rounded-full px-2 py-0.5 text-sm font-bold text-white shadow"
                style="left:{popup.col * CELL_SIZE + CELL_SIZE / 2}px; top:{popup.row *
                    CELL_SIZE}px; background-color:{popup.color};"
            >
                {popup.text}
            </div>
        {/each}
        </div>
        <div><RampartBorder side="right" /></div>

        <RampartCorner />
        <div><RampartBorder side="bottom" /></div>
        <RampartCorner />
    </div>
</div>

<style>
    @keyframes ghost-knight-pulse-frames {
        0%,
        100% {
            opacity: 0.15;
        }
        50% {
            opacity: 0.65;
        }
    }

    .ghost-knight-pulse {
        animation: ghost-knight-pulse-frames 1.8s ease-in-out infinite;
    }

    @keyframes ghost-wall-pulse-frames {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 0.85;
        }
    }

    .ghost-wall-pulse {
        animation: ghost-wall-pulse-frames 1.8s ease-in-out infinite;
    }

    @keyframes region-expand-pulse-frames {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 0.55;
        }
    }

    .region-expand-pulse {
        animation: region-expand-pulse-frames 1.8s ease-in-out infinite;
    }


    @keyframes expansion-arrow-bounce-frames {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-4px);
        }
    }

    .expansion-arrow-bounce {
        animation: expansion-arrow-bounce-frames 1s ease-in-out infinite;
    }

    /* A real heartbeat: two quick beats, then a rest - the idle state of an alliance
       heart this player could actually afford to break. Runs only while cancelling is
       open to them, so a beating heart always means "you can end this".
       Beats every 5.7s rather than every 1.9s. The percentages keep the two beats at
       their original absolute speed (266ms apart) and put the whole 3x slowdown into the
       rest between them - stretching the beats themselves would read as a slow squish
       instead of a pulse. */
    @keyframes alliance-heartbeat-frames {
        0% {
            transform: scale(1);
        }
        4.7% {
            transform: scale(1.22);
        }
        9.3% {
            transform: scale(1);
        }
        14% {
            transform: scale(1.16);
        }
        18.7%,
        100% {
            transform: scale(1);
        }
    }

    /* The alliance coming apart: the heart swells, cracks and collapses while shards spray
       outward. Deliberately quick (620ms against the heartbeat's 5.7s cycle) - it marks a
       moment rather than holding the board. */
    @keyframes alliance-burst-core-frames {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        30% {
            transform: scale(1.55) rotate(-6deg);
            opacity: 1;
        }
        100% {
            transform: scale(0.35) rotate(8deg);
            opacity: 0;
        }
    }

    .alliance-burst-core {
        animation: alliance-burst-core-frames 620ms ease-out forwards;
    }

    /* Each shard is rotated to its own angle first, then thrown "up" along that rotated
       axis - which sends it outward in that direction without needing per-shard x/y. */
    @keyframes alliance-burst-shard-frames {
        0% {
            transform: rotate(var(--shard-angle)) translateY(0) scale(0.85);
            opacity: 0.95;
        }
        100% {
            transform: rotate(var(--shard-angle)) translateY(-30px) scale(0.3);
            opacity: 0;
        }
    }

    .alliance-burst-shard {
        font-size: 11px;
        animation: alliance-burst-shard-frames 620ms cubic-bezier(0.2, 0.75, 0.3, 1) forwards;
    }

    .alliance-heartbeat {
        animation: alliance-heartbeat-frames 5.7s ease-in-out infinite;
    }

    /* The town's name laid across the village itself, dark on parchment so it stays
       legible over forest, hill and village art alike. Centred on the square in both axes
       (hence -50%, -50%) and free to overhang its neighbours, since a town name is nearly
       always wider than one cell - which is also why these live in the overlay layer
       rather than inside a square. */
    .village-name {
        transform: translate(-50%, -50%);
        white-space: nowrap;
        padding: 1px 6px 2px;
        border-radius: 9999px;
        font-size: 12px;
        line-height: 1.25;
        color: #f6e8c8;
        background-color: rgba(43, 26, 10, 0.92);
        border: 1px solid rgba(217, 180, 74, 0.75);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
        opacity: 0;
        /* Out is slower than in: names appear promptly when wanted, and linger a moment on
           the way out so sweeping across the board doesn't strobe. */
        transition: opacity 260ms ease-out;
    }

    .village-name-shown {
        opacity: 1;
        transition: opacity 160ms ease-in;
    }

    /* The renegade knight's arc. The horizontal and vertical travel come in as custom
       properties (the squares differ every time), while the -34px at the midpoint is the
       lift: it's what makes the path bow upward instead of sliding flat across the board.
       Scaling up at the apex and back down on landing does the rest of the 3D read - a
       piece nearer the eye is bigger - and the drop shadow stretching and softening at the
       same moment says the same thing a second way. */
    @keyframes renegade-flight-frames {
        0% {
            transform: translate(0, 0) scale(1);
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
        }
        50% {
            transform: translate(
                    calc(var(--renegade-dx) / 2),
                    calc(var(--renegade-dy) / 2 - 34px)
                )
                scale(1.4);
            filter: drop-shadow(0 14px 9px rgba(0, 0, 0, 0.33));
        }
        100% {
            transform: translate(var(--renegade-dx), var(--renegade-dy)) scale(1);
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
        }
    }

    .renegade-flight {
        animation: renegade-flight-frames 900ms cubic-bezier(0.36, 0, 0.35, 1) forwards;
    }

    /* The turn of coat, held to the middle of the arc: still clearly the old colour as it
       lifts, unmistakably the new one as it lands. */
    @keyframes renegade-colour-out {
        0%,
        22% {
            opacity: 1;
        }
        72%,
        100% {
            opacity: 0;
        }
    }

    @keyframes renegade-colour-in {
        0%,
        22% {
            opacity: 0;
        }
        72%,
        100% {
            opacity: 1;
        }
    }

    .renegade-flight-old {
        animation: renegade-colour-out 900ms linear forwards;
    }

    .renegade-flight-new {
        animation: renegade-colour-in 900ms linear forwards;
    }

    /* The broken heart trembling while you hover it - the alliance is about to give. Fast
       and small (a couple of pixels, a few degrees) so it reads as a shiver rather than a
       wobble, and it runs only during the hover preview, where the heartbeat has stopped. */
    @keyframes alliance-heart-shiver-frames {
        0%,
        100% {
            transform: translate(0, 0) rotate(0deg);
        }
        20% {
            transform: translate(-0.6px, 0.2px) rotate(-2.5deg);
        }
        40% {
            transform: translate(0.6px, -0.2px) rotate(2.5deg);
        }
        60% {
            transform: translate(-0.45px, -0.3px) rotate(-1.75deg);
        }
        80% {
            transform: translate(0.45px, 0.3px) rotate(1.75deg);
        }
    }

    .alliance-heart-shiver {
        display: inline-block; /* transforms don't apply to a purely inline box */
        animation: alliance-heart-shiver-frames 240ms linear infinite;
    }

    @keyframes alliance-price-rise-frames {
        0% {
            transform: translateY(6px);
            opacity: 0;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .alliance-price-rise {
        animation: alliance-price-rise-frames 220ms ease-out forwards;
    }
</style>
