<script lang="ts">
    import BenchLayer from '$lib/components/bench/BenchLayer.svelte'
    import { guildSideOf } from '$lib/model/boardFocus.svelte.js'
    import { MeasuredWidth } from '$lib/model/measuredWidth.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GuildBox } from '$lib/utils/boardGeometry.js'
    import BoardPopup from './BoardPopup.svelte'
    import EnlargedLayer from './EnlargedLayer.svelte'
    import FlightLayer from './FlightLayer.svelte'
    import GuildsSheet from './GuildsSheet.svelte'
    import OpenSeatLayer from './OpenSeatLayer.svelte'
    import SiteCardLayer from './SiteCardLayer.svelte'
    import StackViewLayer from './StackViewLayer.svelte'
    import TracksSheet from './TracksSheet.svelte'
    import WritReferenceLayer from './WritReferenceLayer.svelte'

    /**
     * What stands over the table, drawn in one place only: after the layout, or inside the dialog in
     * full screen. What is open wins: an enlarged card over an open seat, stack view, writ reference
     * or the bench, those over the table. A popup's draft waits under them, and a popover would stand
     * over everything, so it is held back while one is open. A site card gives way to a popup and to
     * every layer.
     */
    const gameSession = getGameSession()
    const layers = gameSession.layers

    const EnlargedWidth = 420
    /** An enlarged guild area, upright: its picture's long side, read at a glance (R-1.3). */
    const EnlargedGuildWidth = 640
    const PhoneMargin = 32
    /** Contract, Seat strip: a seat's sheet stands up to this much of the dynamic viewport. */
    const SeatSheetShare = 85

    const phone = new PhoneLayout()

    const { paintOf } = gameSession

    /**
     * The screen's width as the layers stand on it. The window's `innerWidth` is the phone's layout
     * viewport, which a page wider than the screen widens and which narrows again with no resize
     * event when the page fits once more; a fixed strip across the screen is measured as it stands.
     * The strip is there only while a piece is enlarged, the one time its width is read: watched
     * all the time, it would be caught up in the page settling to the screen, and the browser would
     * report the loop.
     */
    const screen = new MeasuredWidth()
    let across = $derived((screen.width ?? EnlargedWidth + PhoneMargin) - PhoneMargin)
    /** A guild area stands upright, so its short side is the one the screen's width holds. */
    let enlargedWidth = $derived(
        layers.enlarged?.kind === 'guild'
            ? Math.min(EnlargedGuildWidth, (across * GuildBox.width) / GuildBox.height)
            : Math.min(EnlargedWidth, across)
    )
    let popup = $derived(gameSession.boardPopup)
    let bench = $derived(gameSession.guildPanel?.bench)
    /**
     * Contract, Desk layout: on a desk a popup beside a guild area stands only while its side is
     * open; closed by hand, the popup waits for it, as its draft does.
     */
    let anchorShut = $derived.by(() => {
        const side = popup && guildSideOf(popup.anchor)
        return !phone.phone && !gameSession.benchCovers && !!side && layers.guildSide !== side
    })
    let covered = $derived(
        layers.enlarged !== undefined ||
            layers.openSeatId !== undefined ||
            layers.stackView !== undefined ||
            layers.tracksOpen ||
            layers.guildsOpen ||
            layers.writsOpen
    )
</script>

<!-- Nothing here is pressed while the table catches up with what it shows. -->
<div class="contents" data-motion-gate inert={gameSession.updatingVisibleState}>
    {#if bench}
        <BenchLayer {bench} />
    {/if}
    {#if popup && !covered && !anchorShut}
        <BoardPopup {popup} />
    {:else if layers.site && !covered && !bench}
        <SiteCardLayer spaceId={layers.site} onClose={() => layers.closeSite()} />
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
{#if layers.guildsOpen}
    <GuildsSheet onClose={() => layers.closeSeatOrStack()} />
{/if}
{#if layers.writsOpen}
    <WritReferenceLayer
        onClose={() => layers.closeSeatOrStack()}
        sheet={phone.phone ? SeatSheetShare : undefined}
    />
{/if}
{#if layers.enlarged}
    <div
        class="pointer-events-none invisible fixed inset-x-0 top-0 h-0"
        aria-hidden="true"
        {@attach screen.attach}
    ></div>
    <EnlargedLayer
        face={layers.enlarged}
        width={enlargedWidth}
        onClose={() => layers.closeEnlarged()}
    />
{/if}
<FlightLayer animator={gameSession.flightAnimator} {paintOf} />
