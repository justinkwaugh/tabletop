<script lang="ts">
    import BenchLayer from '$lib/components/bench/BenchLayer.svelte'
    import { MeasuredWidth } from '$lib/model/measuredWidth.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BoardPopup from './BoardPopup.svelte'
    import EnlargedLayer from './EnlargedLayer.svelte'
    import FlightLayer from './FlightLayer.svelte'
    import OpenSeatLayer from './OpenSeatLayer.svelte'
    import StackViewLayer from './StackViewLayer.svelte'
    import TracksSheet from './TracksSheet.svelte'

    /**
     * What stands over the table, drawn in one place only: after the layout, or inside the dialog in
     * full screen. What is open wins: an enlarged card over an open seat, stack view or the bench,
     * those over the table. A popup's draft waits under them, and a popover would stand over everything, so it
     * is held back while one is open.
     */
    const gameSession = getGameSession()
    const layers = gameSession.layers

    const EnlargedWidth = 420
    /** An enlarged guild area: its picture's width, read at a glance (R-1.3). */
    const EnlargedGuildWidth = 640
    const PhoneMargin = 32
    /** Contract, Seat strip: a seat's sheet stands up to this much of the dynamic viewport. */
    const SeatSheetShare = 85

    const phone = new PhoneLayout()

    /** A seat's paint from the session's colourizer (S71), as the board draws it. */
    function paintOf(playerId: string) {
        const initial = gameSession.getPlayerName(playerId).charAt(0).toUpperCase()
        return seatPaint(gameSession.colors, playerId, initial)
    }

    /**
     * The screen's width as the layers stand on it. The window's `innerWidth` is the phone's layout
     * viewport, which a page wider than the screen widens and which narrows again with no resize
     * event when the page fits once more; a fixed strip across the screen is measured as it stands.
     */
    const screen = new MeasuredWidth()
    let enlargedWidth = $derived(
        Math.min(
            layers.enlarged?.kind === 'guild' ? EnlargedGuildWidth : EnlargedWidth,
            (screen.width ?? EnlargedWidth + PhoneMargin) - PhoneMargin
        )
    )
    let popup = $derived(gameSession.boardPopup)
    let bench = $derived(gameSession.guildPanel?.bench)
    let covered = $derived(
        layers.enlarged !== undefined ||
            layers.openSeatId !== undefined ||
            layers.stackView !== undefined ||
            layers.tracksOpen
    )
</script>

<div
    class="pointer-events-none invisible fixed inset-x-0 top-0 h-0"
    aria-hidden="true"
    {@attach screen.attach}
></div>

<!-- Nothing here is pressed while the table catches up with what it shows. -->
<div class="contents" data-motion-gate inert={gameSession.updatingVisibleState}>
    {#if bench}
        <BenchLayer {bench} />
    {/if}
    {#if popup && !covered}
        <BoardPopup {popup} />
    {/if}
</div>
{#if layers.openSeatId !== undefined}
    <OpenSeatLayer
        playerId={layers.openSeatId}
        onClose={() => layers.closeSeatOrStack()}
        sheet={phone.phone ? SeatSheetShare : undefined}
    />
{/if}
{#if layers.stackView}
    <StackViewLayer view={layers.stackView} onClose={() => layers.closeSeatOrStack()} />
{/if}
{#if layers.tracksOpen}
    <TracksSheet onClose={() => layers.closeSeatOrStack()} />
{/if}
{#if layers.enlarged}
    <EnlargedLayer
        face={layers.enlarged}
        width={enlargedWidth}
        onClose={() => layers.closeEnlarged()}
    />
{/if}
<FlightLayer animator={gameSession.flightAnimator} {paintOf} />
