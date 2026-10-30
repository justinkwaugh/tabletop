<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        CustomFont,
        GameSession
    } from '@tabletop/frontend-components'
    import type {
        HydratedPromontoryPointGameState,
        PromontoryPointProjectedState
    } from '@tabletop/promontory-point'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import EnlargedView from '$lib/components/EnlargedView.svelte'
    import OpenSeat from '$lib/components/OpenSeat.svelte'
    import { PromontoryPointGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import Oswald500 from '$lib/fonts/Oswald-500.woff2'
    import Oswald600 from '$lib/fonts/Oswald-600.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    } = $props()

    function ensurePromontoryPointGameSession(
        session: GameSession<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    ): PromontoryPointGameSession {
        if (session instanceof PromontoryPointGameSession) {
            return session
        }
        throw new Error('GameTable expected an PromontoryPointGameSession')
    }

    setGameSession(untrack(() => ensurePromontoryPointGameSession(gameSession)))

    // The shared wrapper exposes full screen only as its dialog becoming modal.
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) return
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }
</script>

<CustomFont fontFamily="Oswald" url={Oswald500} format="woff2" fontWeight={500} />
<CustomFont fontFamily="Oswald" url={Oswald600} format="woff2" fontWeight={600} />

<div class="bg-pp-table">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <DefaultSideContent>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultSideContent>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <ActionPanel />
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable maxScale={2}>
                    <Board />
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the panel and the enlarged view come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <div data-fullscreen-panel>
                                    <ActionPanel />
                                </div>
                                <EnlargedView />
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
    {#if !expanded}
        <OpenSeat />
        <EnlargedView />
    {/if}
</div>
