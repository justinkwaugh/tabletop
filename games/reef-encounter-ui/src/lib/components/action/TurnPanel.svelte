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
    import ActionGroup from './ActionGroup.svelte'
    import ParrotfishIcon from '$lib/components/ParrotfishIcon.svelte'
    import { AlgaColor, type CoralColor } from '@tabletop/reef-encounter'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const placing = $derived(gameSession.placing)
    const intent = $derived(gameSession.shrimpIntent)
    const myColor = $derived(gameSession.colors.getPlayerBgColorValue(gameSession.myPlayer?.id))
    const me = $derived(gameSession.myPlayerState)
    const parked = $derived(gameSession.shrimpsOnBareRock)
    const consumedLeft = $derived(placing ? (me?.consumedPolyps[placing.color] ?? 0) : 0)
    const onBoard = $derived([
        ...(gameSession.movableShrimps.length > 0 ? ['pick up a shrimp to move it'] : []),
        ...(gameSession.takeableSpaces.length > 0
            ? ['take a larva space on the open sea to end your turn']
            : [])
    ])
    const supplyLeft = $derived.by(() => {
        if (!placing || !me) return 0
        return Math.min(me.getSupplyPolyps()[placing.color], placing.supplyPolypsLeft)
    })
</script>

{#snippet cube(color: CoralColor)}
    <svg width="24" height="26" viewBox="-12 -13 24 26">
        <LarvaCube center={{ x: 0, y: 0 }} size={21} {color} />
    </svg>
{/snippet}

{#snippet anyCube()}
    <svg class="any-cube" width="24" height="26" viewBox="-12 -13 24 26">
        <path
            d="M0 -10.5 L10.5 -5.25 L10.5 5.25 L0 10.5 L-10.5 5.25 L-10.5 -5.25 Z M-10.5 -5.25 L0 0 L10.5 -5.25 M0 0 L0 10.5"
        ></path>
    </svg>
{/snippet}

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
        Choose a polyp or bare rock, or put it back in your supply from beside it. Choose the shrimp
        again, or Undo, to leave it where it is.
    </p>
{:else if placing && gameSession.placementSquare}
    <p class="prompt reef-display">Which {placing.color} polyp goes there?</p>
    <p class="detail">One from your supply, or a consumed one. Undo cancels.</p>
{:else if placing}
    <p class="prompt reef-display">Place {placing.color} polyps on the reefs</p>
    <p class="detail">
        {supplyLeft} more from your supply{consumedLeft > 0
            ? `, and up to ${consumedLeft} consumed`
            : ''}.{' '}<span class="wide-only">Dashed orange squares consume weaker polyps.</span>
    </p>
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
        <ActionGroup
            step={gameSession.gameState.turn.larvaCubesPlayed === 0 ? 2 : 3}
            verb="Play"
            items={gameSession.larvaCubesToPlay}
            key={({ color }) => color}
            label={({ color, polypsToPlace }) =>
                polypsToPlace > 0
                    ? `Play ${withArticle(color)} larva cube and ${polypsToPlace} ${color} polyp${polypsToPlace === 1 ? '' : 's'}`
                    : `Play ${withArticle(color)} larva cube, though you have no ${color} polyps to place`}
            onselect={({ color }) => gameSession.playLarvaCube(color)}
        >
            {#snippet icon({ color, polypsToPlace })}
                {@render cube(color)}
                <span class="count reef-display" class:none={polypsToPlace === 0}
                    >+{polypsToPlace}</span
                >
            {/snippet}
        </ActionGroup>
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
        <ActionGroup
            step={6}
            verb="Exchange"
            items={gameSession.consumedForCubes}
            key={(color) => color}
            label={(color) =>
                `Exchange a consumed ${color} polyp for ${withArticle(color)} larva cube`}
            onselect={(color) => gameSession.exchangeConsumedPolyp(color)}
        >
            {#snippet icon(color)}
                <PolypChip {color} count={1} consumed />
            {/snippet}
            {#snippet result(color)}
                <span class="arrow">→</span>
                {#if color}{@render cube(color)}{:else}{@render anyCube()}{/if}
            {/snippet}
        </ActionGroup>
        <ActionGroup
            step={7}
            verb="Acquire"
            items={gameSession.cylinderPayments}
            key={(color) => color}
            label={(color) => `Acquire an alga cylinder, paying a consumed ${color} polyp`}
            onselect={(color) => gameSession.chooseCylinderPayment(color)}
        >
            {#snippet icon(color)}
                <PolypChip {color} count={1} consumed />
            {/snippet}
            {#snippet result()}
                <span class="arrow">→</span>
                <svg width="24" height="26" viewBox="-12 -13 24 26">
                    <AlgaCylinder center={{ x: 0, y: 0 }} size={20} color={AlgaColor.Red} />
                </svg>
            {/snippet}
        </ActionGroup>
        <ActionGroup
            step={8}
            verb="Exchange"
            items={gameSession.cubesForPolyps}
            key={(color) => color}
            label={(color) =>
                `Exchange ${withArticle(color)} larva cube for ${withArticle(color)} polyp`}
            onselect={(color) => gameSession.exchangeLarvaCube(color)}
        >
            {#snippet icon(color)}
                {@render cube(color)}
            {/snippet}
            {#snippet result(color)}
                <span class="arrow">→</span>
                {#if color}<PolypChip {color} count={1} />{:else}<span class="any-polyp"
                    ></span>{/if}
            {/snippet}
        </ActionGroup>
    </div>
    {#if onBoard.length > 0}
        <p class="detail">On the table, {onBoard.join(', or ')}.</p>
    {/if}
{/if}

{#if parked.length > 0 && !gameSession.turnChoiceOpen}
    {#each parked.map(squareName) as name (name)}
        <p class="warning">Your shrimp on {name} is on bare rock.</p>
    {/each}
    <p class="warning">
        Before your turn can end, pick {parked.length === 1 ? 'it' : 'each one'} up and move it onto a
        polyp, or put it back in your supply.
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

    .count {
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }

    .arrow {
        color: var(--reef-muted);
    }

    .none {
        opacity: 0.45;
    }

    .any-polyp {
        display: inline-block;
        flex: none;
        border: 1.5px dashed var(--reef-muted);
        width: 22px;
        height: 22px;
        border-radius: 3px;
    }

    .any-cube {
        fill: none;
        stroke: var(--reef-muted);
        stroke-width: 1.2;
        stroke-dasharray: 2.5 2;
        stroke-linejoin: round;
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
