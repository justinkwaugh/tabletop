<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { fade } from 'svelte/transition'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type { HydratedZertzGameState, ZertzGameState } from '@tabletop/zertz'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import OverlayToggle from '$lib/components/OverlayToggle.svelte'
    import { ZertzGameSession } from '$lib/model/session.svelte.js'
    import { getGameSession, setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<ZertzGameState, HydratedZertzGameState> } =
        $props()
    assert(gameSession instanceof ZertzGameSession, 'ZÈRTZ needs its own game session')
    setGameSession(gameSession)
    const session = getGameSession()

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

    // Turning auto-jump on shows nothing on the board until a jump comes up, so a press says
    // what it did for a moment.
    const NOTICE_MS = 2000
    let autoJumpNotice: boolean | undefined = $state()
    let noticeTimer: ReturnType<typeof setTimeout> | undefined

    async function toggleAutoJump() {
        const on = await session.toggleAutoJump()
        if (on === undefined) return
        autoJumpNotice = on
        clearTimeout(noticeTimer)
        noticeTimer = setTimeout(() => {
            autoJumpNotice = undefined
        }, NOTICE_MS)
    }
</script>

{#snippet turnControls()}
    <Header />
    <div class="action-card">
        <ActionPanel />
    </div>
{/snippet}

<div class="zertz-table zertz-water">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#f4efe4]"
                disabledColor="text-[#5d8aa6]"
                borderClass="border-[#2f74a0] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#f4efe4]"
                    disabledColor="text-[#5d8aa6]"
                    borderClass="rounded-lg border-2 border-[#2f74a0]"
                />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 max-sm:[&_svg]:hidden bg-[#f1ece0] border-2 border-transparent rounded-lg text-[#0a3554]"
                inactiveTabClass="text-[#f4efe4] py-1 px-3 max-sm:[&_svg]:hidden rounded-lg border-2 border-transparent hover:border-[#2f74a0]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-400"
                        bgColor="bg-[#0a3554]"
                        inputBgColor="bg-[#0a3554]"
                        inputBorderColor="border-[#2f74a0]"
                        borderColor="border-[#2f74a0]"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div
                class="relative isolate grow-0 overflow-hidden pt-2"
                style="flex:1; min-height: 40dvh;"
            >
                <ScalingWrapper
                    justify="center"
                    controls="bottom-left"
                    maxScale={4}
                    maxFitScale={2.5}
                    renderAtViewScale
                    expandable
                >
                    <Board />
                    {#snippet overlay()}
                        <div
                            class="pointer-events-auto absolute right-3 bottom-2 z-10 flex items-center gap-1.5"
                        >
                            <OverlayToggle
                                glyph="A1"
                                label="Coordinates"
                                hint={gameSession.showCoordinates
                                    ? 'Hide the coordinates'
                                    : 'Show the coordinates round the board'}
                                pressed={gameSession.showCoordinates}
                                onToggle={() => gameSession.toggleCoordinates()}
                            />
                            {#if gameSession.showsAutoJump}
                                <OverlayToggle
                                    label="Auto-jump"
                                    hint={gameSession.autoJump
                                        ? 'Auto-jump is on: a jump with only one choice is made for you at once, even while you are away. Press to turn it off.'
                                        : 'Auto-jump is off. Press to have a jump with only one choice made for you at once, even while you are away.'}
                                    pressed={gameSession.autoJump}
                                    disabled={!gameSession.canSetAutoJump}
                                    onToggle={toggleAutoJump}
                                >
                                    <!-- A robot head, then a marble hopping over another. -->
                                    <svg
                                        width="30"
                                        height="16"
                                        viewBox="-8 -8 30.5 16"
                                        aria-hidden="true"
                                    >
                                        <path d="M 0 -5 L 0 -6.6" class="line"></path>
                                        <circle cx="0" cy="-7" r="1" class="dot"></circle>
                                        <rect
                                            x="-5.5"
                                            y="-5"
                                            width="11"
                                            height="9.5"
                                            rx="2.2"
                                            class="line"
                                        ></rect>
                                        <circle cx="-2.3" cy="-1" r="1.25" class="dot"></circle>
                                        <circle cx="2.3" cy="-1" r="1.25" class="dot"></circle>
                                        <path d="M -2 2 L 2 2" class="line"></path>
                                        <path d="M -7.2 -1.5 L -7.2 1" class="line"></path>
                                        <path d="M 7.2 -1.5 L 7.2 1" class="line"></path>
                                        <g transform="translate(15.5 1)">
                                            <circle cx="0" cy="2.5" r="1.8" class="dot"></circle>
                                            <path d="M -5.5 2.5 Q 0 -8 5.5 1" class="line"></path>
                                            <path d="M 2.8 0 L 5.6 1.1 L 6 -1.9" class="line"
                                            ></path>
                                        </g>
                                    </svg>
                                </OverlayToggle>
                            {/if}
                            {#if autoJumpNotice !== undefined}
                                <div
                                    class="auto-jump-notice"
                                    class:on={autoJumpNotice}
                                    role="status"
                                    in:fade={{ duration: 150 }}
                                    out:fade={{ duration: 300 }}
                                >
                                    Auto-jump {autoJumpNotice ? 'ON' : 'OFF'}
                                </div>
                            {/if}
                            <OverlayToggle
                                label="Far side"
                                hint={gameSession.turned
                                    ? 'See the board from your own side again'
                                    : 'See the board from the far side'}
                                pressed={gameSession.turned}
                                onToggle={() => gameSession.toggleTurned()}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="-8 -8 16 16"
                                    aria-hidden="true"
                                >
                                    <path d="M -5.5 -1 A 5.5 5.5 0 0 1 4.5 -3.2" class="line"
                                    ></path>
                                    <path d="M 2 -5 L 4.8 -3 L 2.2 -0.8" class="line"></path>
                                    <path d="M 5.5 1 A 5.5 5.5 0 0 1 -4.5 3.2" class="line"></path>
                                    <path d="M -2 5 L -4.8 3 L -2.2 0.8" class="line"></path>
                                </svg>
                            </OverlayToggle>
                        </div>
                    {/snippet}
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <!-- The dialog paints its own dim backdrop, so full screen needs the water redrawn behind the board. -->
                                <div class="fullscreen-water zertz-water" aria-hidden="true"></div>
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
    .zertz-table {
        color: var(--zertz-ink);
    }

    .action-card {
        margin: 0 8px;
        border-radius: 12px;
        background: var(--zertz-panel);
        box-shadow: inset 0 0 0 1px var(--zertz-panel-edge);
    }

    /* DefaultTableLayout leaves a tenth of a phone screen showing the sidebar's edge. The history
       controls sit above the table there, so the board takes all but a sliver of the narrower
       player cards; the tabs drop their icons to fit. As in DVONN. */
    @media (width < 40rem) {
        .zertz-table :global(.game-column.game-column) {
            min-width: calc(100vw - 20px);
        }

        .zertz-table :global(div:has(+ .game-column)) {
            width: 260px;
            min-width: 260px;
        }
    }

    /* Over the chip row, in the auto-jump chip's own ink. */
    .auto-jump-notice {
        position: absolute;
        right: 0;
        bottom: calc(100% + 6px);
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--zertz-panel);
        box-shadow:
            inset 0 0 0 1px var(--zertz-panel-edge),
            var(--zertz-panel-shadow);
        color: var(--zertz-ink-quiet);
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        pointer-events: none;
    }

    .auto-jump-notice.on {
        color: var(--zertz-ink);
    }

    .fullscreen-water {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }

    .fullscreen-controls {
        padding-bottom: 8px;
    }
</style>
