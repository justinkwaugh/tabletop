<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        ScalingWrapper,
        DefaultTableLayout,
        GameSession,
        GameChat,
        CustomFont,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type {
        HydratedStellarHorizonsGameState,
        StellarHorizonsProjectedState
    } from '@tabletop/stellar-horizons-2'
    import { TECH_FIELDS, TurnStep, type TechField } from '@tabletop/stellar-horizons-2'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionCard from '$lib/components/ActionCard.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import TechTree from '$lib/components/TechTree.svelte'
    import PrototypeSwitcher from '$lib/components/board/prototype/PrototypeSwitcher.svelte'
    import { StellarHorizonsGameSession } from '$lib/model/session.svelte'
    import { getGameSession, setGameSession } from '$lib/model/sessionContext.svelte'
    import HindDigitsFont from '$lib/fonts/Hind-Bold-digits.woff2'

    let {
        gameSession
    }: {
        gameSession: GameSession<StellarHorizonsProjectedState, HydratedStellarHorizonsGameState>
    } = $props()
    assert(
        gameSession instanceof StellarHorizonsGameSession,
        'Stellar Horizons needs its own game session'
    )
    setGameSession(gameSession)
    const session = getGameSession()

    type TableView = 'map' | 'techs'
    let chosenView: { step: TurnStep | undefined; view: TableView } | undefined = $state()
    const view: TableView = $derived(
        chosenView && chosenView.step === session.actingStep
            ? chosenView.view
            : session.actingStep === TurnStep.Development
              ? 'techs'
              : 'map'
    )

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

    let techFocus: TechField | undefined = $state()

    function choose(next: TableView) {
        chosenView = { step: session.actingStep, view: next }
    }
</script>

{#snippet turnControls()}
    <Header />
    <ActionCard>
        {#if session.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </ActionCard>
{/snippet}

<CustomFont fontFamily="Hind Digits" url={HindDigitsFont} format="woff2" fontWeight="700" />

<PrototypeSwitcher />

<div class="table-surface">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#dbe7f5]"
                disabledColor="text-[#3d4a63]"
                borderClass="border-[#2a3a57] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#dbe7f5]" disabledColor="text-[#3d4a63]" />
            </div>
            <DefaultTabs
                playersTitle="Factions"
                activeTabClass="py-1 px-3 bg-[#7fd3ff] border-2 border-transparent rounded-lg text-[#05070d]"
                inactiveTabClass="text-[#7fd3ff] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#7fd3ff]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-500"
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-gray-500"
                        borderColor="border-gray-500"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
                <div class="view-toggle">
                    <button
                        type="button"
                        class:active={view === 'map'}
                        onclick={() => choose('map')}>Star map</button
                    >
                    <button
                        type="button"
                        class:active={view === 'techs'}
                        onclick={() => choose('techs')}>Tech chart</button
                    >
                    {#if view === 'techs'}
                        <span class="divider"></span>
                        <button
                            type="button"
                            class:active={techFocus === undefined}
                            onclick={() => (techFocus = undefined)}>All</button
                        >
                        {#each TECH_FIELDS as field (field)}
                            <button
                                type="button"
                                class:active={techFocus === field}
                                onclick={() => (techFocus = field)}>{field}</button
                            >
                        {/each}
                    {/if}
                </div>
            </div>
            <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
                    {#if view === 'map'}
                        <Board />
                    {:else}
                        <TechTree focus={techFocus} />
                    {/if}
                    {#snippet toolbar()}
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <div class="fullscreen-controls">
                                    {@render turnControls()}
                                </div>
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .table-surface {
        background: #070b14;
        color: #dbe7f5;
    }

    .view-toggle {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding-top: 8px;
    }

    .view-toggle button {
        border: 1px solid #2a3a57;
        border-radius: 999px;
        padding: 2px 14px;
        font-size: 14px;
        letter-spacing: 0.06em;
        color: #9fb4d0;
    }

    .view-toggle button.active {
        background: #7fd3ff;
        border-color: #7fd3ff;
        color: #05070d;
    }

    .divider {
        width: 1px;
        background: #2a3a57;
        margin: 0 6px;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #070b14;
    }
</style>
