<script lang="ts">
    import { squareName } from '$lib/utils/reefSquare.js'
    import { withArticle } from '$lib/utils/actionDescription.js'
    import ChoiceButton from './ChoiceButton.svelte'
    import LarvaCube from '$lib/components/table/LarvaCube.svelte'
    import Shrimp from '$lib/components/table/Shrimp.svelte'
    import AlgaCylinder from '$lib/components/table/AlgaCylinder.svelte'
    import PolypChip from '$lib/components/PolypChip.svelte'
    import EatPrompt from './EatPrompt.svelte'
    import ActionTile from './ActionTile.svelte'
    import ParrotfishIcon from '$lib/components/ParrotfishIcon.svelte'
    import { AlgaColor } from '@tabletop/reef-encounter'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const placing = $derived(gameSession.placing)
    const intent = $derived(gameSession.shrimpIntent)
    const myColor = $derived(gameSession.colors.getPlayerBgColorValue(gameSession.myPlayer?.id))
    const me = $derived(gameSession.myPlayerState)
    const parked = $derived(gameSession.shrimpsOnBareRock)
    const consumedLeft = $derived(placing ? (me?.consumedPolyps[placing.color] ?? 0) : 0)
    const screenLeft = $derived.by(() => {
        if (!placing || !me) return 0
        return Math.min(me.getScreenPolyps()[placing.color], placing.screenPolypsLeft)
    })
</script>

{#if gameSession.choosingCoralToEat}
    <EatPrompt />
{:else if gameSession.cylinderAlga}
    <p class="prompt reef-display">Put the {gameSession.cylinderAlga} cylinder on the open sea</p>
    <p class="detail">
        On the cylinder space, where it turns every unlocked coral tile whose large alga is
        {gameSession.cylinderAlga}{gameSession.cylinderTargets.tileIds.length > 0
            ? ', or on one of those tiles to lock it'
            : ''}. Undo goes back a step.
    </p>
    {#if gameSession.lockingLastTile !== undefined}
        <p class="warning">
            Tile {gameSession.lockingLastTile} is the last unlocked coral tile: locking it ends the game,
            and every other player then has one final turn.
        </p>
    {/if}
{:else if gameSession.cylinderPayment}
    <p class="prompt reef-display">Choose the cylinder's colour</p>
    <p class="detail">
        Paid with a consumed {gameSession.cylinderPayment} polyp. Undo goes back a step.
    </p>
    <div class="choices">
        {#each gameSession.cylinderAlgas as alga (alga)}
            <ChoiceButton
                label="A {alga} cylinder"
                onclick={() => gameSession.chooseCylinderAlga(alga)}
            >
                <svg width="34" height="36" viewBox="-17 -18 34 36" aria-hidden="true">
                    <AlgaCylinder center={{ x: 0, y: 0 }} size={28} color={alga} />
                </svg>
                <span class="count">{gameSession.gameState.algaSupply[alga]}</span>
            </ChoiceButton>
        {/each}
    </div>
{:else if intent?.kind === 'introduce'}
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
            : ''}.{' '}<span class="wide-only">Dashed orange squares consume weaker polyps.</span>
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
    <p class="prompt reef-display">Choose your actions</p>
{/if}

{#if gameSession.cubeToPlay && !gameSession.turnChoiceOpen}
    <p class="warning">
        Play the {gameSession.cubeToPlay} larva cube you just bought before anything else, or trade it
        for a polyp.
    </p>
{/if}

{#if !gameSession.turnChoiceOpen}
    <div class="options">
        {#if gameSession.canEatCoral}
            <ActionTile
                step={1}
                verb="Eat"
                label="Eat a coral and a shrimp"
                onclick={() => gameSession.startChoosingCoralToEat()}
            >
                <ParrotfishIcon paint={myColor} />
            </ActionTile>
        {/if}
        {#each gameSession.larvaCubesToPlay as { color, polypsToPlace } (color)}
            <ActionTile
                step={placing ? 3 : 2}
                verb="Play"
                label={polypsToPlace > 0
                    ? `Play ${withArticle(color)} larva cube and ${polypsToPlace} ${color} polyp${polypsToPlace === 1 ? '' : 's'}`
                    : `Play ${withArticle(color)} larva cube, though you have no ${color} polyps to place`}
                onclick={() => gameSession.playLarvaCube(color)}
            >
                <svg width="24" height="26" viewBox="-12 -13 24 26">
                    <LarvaCube center={{ x: 0, y: 0 }} size={21} {color} />
                </svg>
                <span class="plus">+</span>
                <span class:none={polypsToPlace === 0}>
                    <PolypChip {color} count={Math.max(polypsToPlace, 1)} />
                </span>
                {#if polypsToPlace === 0}<span class="none">0</span>{/if}
            </ActionTile>
        {/each}
        {#if gameSession.canIntroduceShrimp}
            <ActionTile
                step={4}
                verb="Introduce"
                label="Introduce a shrimp"
                onclick={() => gameSession.startIntroducingShrimp()}
            >
                <svg width="18" height="28" viewBox="0 0 18 28">
                    <Shrimp center={{ x: 9, y: 14 }} length={26} color={myColor} />
                </svg>
            </ActionTile>
        {/if}
        {#if gameSession.movableShrimps.length > 0}
            <ActionTile step={5} verb="Move" label="Pick up one of your shrimps to move it">
                <svg width="18" height="28" viewBox="0 0 18 28">
                    <Shrimp center={{ x: 9, y: 14 }} length={26} color={myColor} />
                </svg>
            </ActionTile>
        {/if}
        {#each gameSession.consumedForCubes as color (color)}
            <ActionTile
                step={6}
                verb="Exchange"
                label="Exchange a consumed {color} polyp for {withArticle(color)} larva cube"
                onclick={() => gameSession.exchangeConsumedPolyp(color)}
            >
                <PolypChip {color} count={1} consumed />
                <span class="arrow">→</span>
                <svg width="24" height="26" viewBox="-12 -13 24 26">
                    <LarvaCube center={{ x: 0, y: 0 }} size={21} {color} />
                </svg>
            </ActionTile>
        {/each}
        {#each gameSession.cylinderPayments as color (color)}
            <ActionTile
                step={7}
                verb="Acquire"
                label="Acquire an alga cylinder, paying a consumed {color} polyp"
                onclick={() => gameSession.chooseCylinderPayment(color)}
            >
                <PolypChip {color} count={1} consumed />
                <span class="arrow">→</span>
                <svg width="24" height="26" viewBox="-12 -13 24 26">
                    <AlgaCylinder center={{ x: 0, y: 0 }} size={20} color={AlgaColor.Red} />
                </svg>
            </ActionTile>
        {/each}
        {#each gameSession.cubesForPolyps as color (color)}
            <ActionTile
                step={8}
                verb="Exchange"
                label="Exchange {withArticle(color)} larva cube for {withArticle(color)} polyp"
                onclick={() => gameSession.exchangeLarvaCube(color)}
            >
                <svg width="24" height="26" viewBox="-12 -13 24 26">
                    <LarvaCube center={{ x: 0, y: 0 }} size={21} {color} />
                </svg>
                <span class="arrow">→</span>
                <PolypChip {color} count={1} />
            </ActionTile>
        {/each}
        {#if gameSession.takeableSpaces.length > 0}
            <ActionTile
                step={10}
                verb="Collect"
                label="Collect a larva cube and polyps to end your turn"
            >
                <span class="words">cube + polyps</span>
            </ActionTile>
        {/if}
    </div>
{/if}

{#if parked.length > 0 && !gameSession.turnChoiceOpen}
    {#each parked.map(squareName) as name (name)}
        <p class="warning">Your shrimp on {name} is on bare rock.</p>
    {/each}
    <p class="warning">
        Before your turn can end, pick {parked.length === 1 ? 'it' : 'each one'} up and move it onto a
        polyp, or put it back behind your screen.
    </p>
{/if}

<style>
    .options {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
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

    .arrow,
    .plus {
        color: var(--reef-muted);
    }

    .none {
        opacity: 0.45;
    }

    .words {
        color: var(--reef-muted);
    }

    @media (max-width: 639px) {
        .wide-only {
            display: none;
        }

        .options {
            gap: 6px;
            margin-top: 6px;
        }

        .choices {
            gap: 6px;
            margin-top: 4px;
        }
    }
</style>
