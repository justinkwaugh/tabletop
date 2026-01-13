<script lang="ts">
import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import CardBack from '$lib/images/cardBack2.png'
    import { Suit } from '@tabletop/sol'
    import Card from './Card.svelte'
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import PlayerAid from '$lib/images/sol-player-aid.jpg'
    import { Popover } from 'flowbite-svelte'
    import EffectsPicker from './pickers/EffectsPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession
    let showEffectPicker = $state(false)
    let cardBackImage = `url(${CardBack})`
    function back() {
        gameSession.back()
    }

    async function undo() {
        await gameSession.undo()
    }

    let currentSolarFlare = $derived(
        gameSession.gameState.solarFlares - gameSession.gameState.solarFlaresRemaining + 1
    )
</script>

<div
    id="sol-header"
    class="flex flex-row justify-between items-center pb-1 sm:px-4 max-sm:text-[16px] text-xl tracking-[.15em] max-sm:h-[40px] h-[44px] border-b border-[#ad9c80] max-sm:leading-none"
>
    <div class="header-grid grid">
        {#if gameSession.isViewingHistory}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <div>HISTORY</div>
            </div>
        {:else if !gameSession.isMyTurn}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <div>
                    <PlayerName
                        playerId={gameSession.gameState.turnManager.currentTurn()?.playerId}
                        capitalization="uppercase"
                        possessive={true}
                        additionalClasses="tracking-widest pt-[2px]"
                    /> TURN
                </div>
            </div>
        {:else if gameSession.isEndOfGame}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <div>END OF GAME</div>
            </div>
        {:else if gameSession.isMoving}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <MoveArrows />
                <div>MOVING ({gameSession.myPlayerState?.movementPoints ?? 0})</div>
            </div>
        {:else if gameSession.isConverting}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <ConvertAtom />
                <div>CONVERTING</div>
            </div>
        {:else if gameSession.isActivating}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <ActivateBolt />
                <div>ACTIVATING</div>
            </div>
        {:else if gameSession.isDrawingCards || gameSession.isChoosingCard}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <div
                    class="rounded-sm dark:bg-gray-700 h-[36px] w-[26px] overflow-hidden border-1 border-[#5a5141]"
                >
                    <div
                        style="background-image: {cardBackImage}"
                        class="bg-center bg-cover w-full h-full"
                    ></div>
                </div>
                <div>INSTABILITY CARDS</div>
            </div>
        {:else if gameSession.isSolarFlares}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <div class="rounded-sm dark:bg-gray-700 h-[36px] w-[22px] overflow-hidden">
                    <Card card={{ id: 'header-flare', suit: Suit.Flare }} />
                </div>
                <div>
                    SOLAR FLARE {#if gameSession.gameState.solarFlares > 1}{currentSolarFlare}&nbsp;OF&nbsp;{gameSession
                            .gameState.solarFlares}{/if}
                </div>
            </div>
        {:else}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="inline-flex items-center gap-x-2"
            >
                <PlayerName
                    playerId={gameSession.gameState.turnManager.currentTurn()?.playerId}
                    capitalization="uppercase"
                    possessive={true}
                    additionalClasses="tracking-widest pt-[2px]"
                /> TURN
            </div>
        {/if}
    </div>

    {#if gameSession.isActingAdmin}
        <button
            onclick={() => {
                showEffectPicker = true
            }}
            class="w-fit box-border flex items-center justify-center text-sm bg-transparent"
        >
            EFFECT PICKER
        </button>
        {#if showEffectPicker}
            <EffectsPicker />
        {/if}
    {/if}

    <div class="flex flex-row items-center gap-x-2">
        <div class="header-grid grid">
            {#if gameSession.midAction}
                <button
                    onclick={back}
                    class="w-fit box-border flex items-center justify-center text-lg bg-transparent rounded-lg"
                >
                    UNDO
                </button>
            {:else if gameSession.undoableAction}
                <button
                    onclick={undo}
                    class="w-fit box-border flex items-center justify-center text-lg bg-transparent rounded-lg"
                >
                    UNDO
                </button>
            {/if}
        </div>
        <div
            id="player-aid"
            class="leading-none tracking-tight rounded-full bg-[#ad9c80] h-[24px] w-[24px] flex items-center justify-center text-lg font-bold text-[#333]"
        >
            ?
        </div>
        <Popover
            reference={'#sol-header'}
            classes={{
                content: 'p-0 rounded-md overflow-hidden dark:border-0'
            }}
            placement="bottom"
            triggeredBy={`#player-aid`}
            trigger="click"
            offset={25}
            arrow={false}><img src={PlayerAid} alt="player aid" class="w-[640px]" /></Popover
        >
    </div>
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }
</style>
