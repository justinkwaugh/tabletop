<script lang="ts">
    import ChoiceButton from './ChoiceButton.svelte'
    import LarvaCube from '$lib/components/table/LarvaCube.svelte'
    import Shrimp from '$lib/components/table/Shrimp.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const placing = $derived(gameSession.placing)
    const intent = $derived(gameSession.shrimpIntent)
    const myColor = $derived(gameSession.colors.getPlayerBgColorValue(gameSession.myPlayer?.id))
    const me = $derived(gameSession.myPlayerState)
    const consumedLeft = $derived(placing ? (me?.consumedPolyps[placing.color] ?? 0) : 0)
    const screenLeft = $derived.by(() => {
        if (!placing || !me) return 0
        const onScreen =
            (me.knownScreenPolyps?.[placing.color] ?? 0) +
            (me.secretScreenPolyps?.[placing.color] ?? 0)
        return Math.min(onScreen, placing.screenPolypsLeft)
    })
</script>

{#if intent?.kind === 'introduce'}
    <p class="prompt reef-display">Choose a polyp for your shrimp</p>
    <p class="detail">It may go on any coral without a shrimp. Undo cancels.</p>
{:else if intent?.kind === 'move'}
    <p class="prompt reef-display">Move your shrimp</p>
    <p class="detail">
        Choose a polyp or bare rock, or put it back behind your screen. Undo cancels.
    </p>
    <div class="choices">
        <ChoiceButton
            label="Put the shrimp back behind your screen"
            onclick={() => gameSession.returnShrimpBehindScreen()}
        >
            <span class="choice-text">Back behind your screen</span>
        </ChoiceButton>
    </div>
{:else if placing}
    <p class="prompt reef-display">Place {placing.color} polyps on the reefs</p>
    <p class="detail">
        {screenLeft} more from behind your screen{consumedLeft > 0
            ? `, and up to ${consumedLeft} consumed`
            : ''}. Highlighted squares can take one; dashed orange squares attack a weaker polyp.
    </p>
    {#if gameSession.placementSources.length > 1}
        <div class="choices" role="group" aria-label="Where the polyp comes from">
            <ChoiceButton
                label="Place from behind your screen"
                selected={gameSession.placementSource === 'screen'}
                onclick={() => gameSession.choosePlacementSource('screen')}
            >
                <span class="choice-text">From your screen</span>
            </ChoiceButton>
            <ChoiceButton
                label="Place a consumed polyp"
                selected={gameSession.placementSource === 'consumed'}
                onclick={() => gameSession.choosePlacementSource('consumed')}
            >
                <span class="choice-text">Consumed</span>
            </ChoiceButton>
        </div>
    {/if}
{:else}
    <p class="prompt reef-display">Grow your reefs</p>
{/if}

{#if !intent && gameSession.larvaCubesToPlay.length > 0}
    <div class="row">
        <span class="label">
            {placing ? 'Play another larva cube' : 'Play a larva cube'}
        </span>
        <div class="choices">
            {#each gameSession.larvaCubesToPlay as { color, polypsToPlace } (color)}
                <ChoiceButton
                    label={polypsToPlace > 0
                        ? `Play a ${color} larva cube`
                        : `Play a ${color} larva cube, though you have no ${color} polyps to place`}
                    onclick={() => gameSession.playLarvaCube(color)}
                >
                    <svg width="36" height="38" viewBox="-18 -19 36 38" aria-hidden="true">
                        <LarvaCube center={{ x: 0, y: 0 }} size={32} {color} />
                    </svg>
                    <span class="count" class:none={polypsToPlace === 0}>
                        {polypsToPlace > 0 ? polypsToPlace : 'none'}
                    </span>
                </ChoiceButton>
            {/each}
        </div>
    </div>
{/if}

{#if !intent && (gameSession.canIntroduceShrimp || gameSession.movableShrimps.length > 0)}
    <div class="row">
        <span class="label">Shrimps</span>
        {#if gameSession.canIntroduceShrimp}
            <ChoiceButton
                label="Introduce a shrimp"
                onclick={() => gameSession.startIntroducingShrimp()}
            >
                <svg width="22" height="34" viewBox="0 0 22 34" aria-hidden="true">
                    <Shrimp center={{ x: 11, y: 17 }} size={32} color={myColor} />
                </svg>
                <span class="choice-text">Introduce</span>
            </ChoiceButton>
        {/if}
        {#if gameSession.movableShrimps.length > 0}
            <span class="label">or pick up one of yours on the reefs to move it</span>
        {/if}
    </div>
{/if}

{#if gameSession.hasShrimpOnBareRock && !intent}
    <p class="warning">
        Your shrimp on bare rock must move onto a polyp or back behind your screen before your turn
        can end.
    </p>
{/if}

{#if gameSession.takeableSpaces.length > 0}
    <p class="detail end">Take a larva cube and its polyps from the open sea to end your turn.</p>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin-top: 8px;
    }

    .label {
        font-size: 14px;
        color: var(--reef-muted);
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
    }

    .choice-text {
        padding-inline: 8px;
        font-size: 14px;
    }

    .count {
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }

    .count.none {
        color: var(--reef-muted);
        font-style: italic;
    }

    .warning {
        margin-top: 8px;
        font-size: 14px;
        color: #ffd29a;
    }

    .end {
        margin-top: 8px;
    }
</style>
