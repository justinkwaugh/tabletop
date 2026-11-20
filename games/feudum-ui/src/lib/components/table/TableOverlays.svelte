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

    /** `innerWidth` narrows with no event; measured only while enlarged, else an observer loop. */
    const screen = new MeasuredWidth()
    let across = $derived((screen.width ?? EnlargedWidth + PhoneMargin) - PhoneMargin)
    let enlargedWidth = $derived(
        layers.enlarged?.kind === 'guild'
            ? Math.min(EnlargedGuildWidth, (across * GuildBox.width) / GuildBox.height)
            : Math.min(EnlargedWidth, across)
    )
    let popup = $derived(gameSession.boardPopup)
    let bench = $derived(gameSession.guildPanel?.bench)
    /** Contract, Desk layout: a popup beside a guild area stands only while its side is open. */
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
