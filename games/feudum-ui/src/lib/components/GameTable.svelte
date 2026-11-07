<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import {
        CustomFont,
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession,
        HistoryControls
    } from '@tabletop/frontend-components'
    import type { HydratedFeudumGameState, FeudumProjectedState } from '@tabletop/feudum'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import ActionArea from '$lib/components/table/ActionArea.svelte'
    import Header from '$lib/components/table/Header.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import TableOverlays from '$lib/components/table/TableOverlays.svelte'
    import { FontFaces } from '$lib/fonts/fonts.js'
    import { FeudumGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<FeudumProjectedState, HydratedFeudumGameState> } = $props()

    function ensureFeudumGameSession(
        session: GameSession<FeudumProjectedState, HydratedFeudumGameState>
    ): FeudumGameSession {
        if (session instanceof FeudumGameSession) {
            return session
        }
        throw new Error('GameTable expected a FeudumGameSession')
    }

    const feudumSession = untrack(() => ensureFeudumGameSession(gameSession))
    setGameSession(feudumSession)
    setTableLayers(feudumSession.layers)

    /** Below this fit the board's targets are too small to tap: a phone rests at a cover fit. */
    const CoverBelowScale = 0.2

    /** The wrapper shows full screen only as its dialog becoming modal. */
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) {
            return
        }
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }

    /**
     * Contract, Coexistence and precedence: Escape closes one layer at a time, and only with none
     * open does it reach the wrapper, to leave full screen. Taken on the way down, before the dialog.
     */
    function onEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && feudumSession.layers.escape()) {
            event.preventDefault()
            event.stopPropagation()
        }
    }
</script>

{#each FontFaces as face (face.family)}
    <CustomFont fontFamily={face.family} url={face.url} format={face.format} />
{/each}

<svelte:window onkeydowncapture={onEscape} />

{#snippet turnControls()}
    <div class="bg-feudum-surface" data-turn-controls>
        <Header />
        <ActionArea />
    </div>
{/snippet}

<div>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls />
        {/snippet}
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
                {#if !expanded}
                    {@render turnControls()}
                {/if}
            </div>
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    coverBelowScale={CoverBelowScale}
                    expandable
                >
                    <Board />
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog: the panel and all that stands over the table come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                {@render turnControls()}
                                <TableOverlays />
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
    {#if !expanded}
        <TableOverlays />
    {/if}
</div>
