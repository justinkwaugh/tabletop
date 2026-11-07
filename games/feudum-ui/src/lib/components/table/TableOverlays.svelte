<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BoardPopup from './BoardPopup.svelte'
    import EnlargedFaceView from './EnlargedFaceView.svelte'
    import OpenSeatLayer from './OpenSeatLayer.svelte'
    import Scrim from './Scrim.svelte'
    import StackViewLayer from './StackViewLayer.svelte'

    /**
     * What stands over the table, drawn in one place only: after the layout, or inside the dialog in
     * full screen. What is open wins: an enlarged card over an open seat or stack view, those over
     * the table. A popup's draft waits under them, and a popover would stand over everything, so it
     * is held back while one is open.
     */
    const gameSession = getGameSession()
    const layers = gameSession.layers

    const EnlargedWidth = 420
    const PhoneMargin = 32

    let innerWidth = $state(EnlargedWidth + PhoneMargin)
    let enlargedWidth = $derived(Math.min(EnlargedWidth, innerWidth - PhoneMargin))
    let popup = $derived(gameSession.boardPopup)
    let covered = $derived(
        layers.enlarged !== undefined || layers.openSeatId !== undefined || layers.stackView
    )
</script>

<svelte:window bind:innerWidth />

{#if popup && !covered}
    <BoardPopup {popup} />
{/if}
{#if layers.openSeatId !== undefined}
    <OpenSeatLayer playerId={layers.openSeatId} onClose={() => layers.closeSeatOrStack()} />
{/if}
{#if layers.stackView}
    <StackViewLayer view={layers.stackView} onClose={() => layers.closeSeatOrStack()} />
{/if}
{#if layers.enlarged}
    <Scrim label="the enlarged piece" layer="enlarged" onClose={() => layers.closeEnlarged()}>
        <div class="pointer-events-none" data-enlarged={layers.enlarged.kind}>
            <EnlargedFaceView face={layers.enlarged} width={enlargedWidth} />
        </div>
    </Scrim>
{/if}
