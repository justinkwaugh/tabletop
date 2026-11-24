<script lang="ts">
    import BenchLayer from '$lib/components/bench/BenchLayer.svelte'
    import { MeasuredWidth } from '$lib/model/measuredWidth.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardFloatOf } from '$lib/model/tableLayers.svelte.js'
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
    /** Contract, Phone layout: a seat's sheet stands up to this much of the dynamic viewport. */
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
    let bench = $derived(gameSession.guildPanel?.bench)
    let float = $derived(
        boardFloatOf(layers, {
            popup: gameSession.boardPopup,
            bench: bench !== undefined,
            benchCovers: gameSession.benchCovers,
            desk: !phone.phone
        })
    )
</script>

<div class="contents" data-motion-gate inert={gameSession.updatingVisibleState}>
    {#if bench}
        <BenchLayer {bench} />
    {/if}
    {#if float?.kind === 'popup'}
        <BoardPopup popup={float.popup} />
    {:else if float?.kind === 'site'}
        <SiteCardLayer spaceId={float.spaceId} onClose={() => layers.closeSite()} />
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
