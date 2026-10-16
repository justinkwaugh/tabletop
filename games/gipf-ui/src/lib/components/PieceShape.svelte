<svelte:options namespace="svg" />

<script lang="ts">
    import { Color } from '@tabletop/common'
    import { pieceDiscs } from '$lib/board/pieceGeometry.js'

    let { color, gipf, radius }: { color: Color; gipf: boolean; radius: number } = $props()

    const id = $props.id()
    const light = $derived(color === Color.White)
    const discs = $derived(pieceDiscs(gipf, radius))
    const top = $derived(discs[discs.length - 1])
</script>

<defs>
    <radialGradient id="gipf-face-{id}" cx="0.45" cy="0.4" r="0.75">
        {#if light}
            <stop offset="0" stop-color="#f6f3ec"></stop>
            <stop offset="1" stop-color="#e2dccf"></stop>
        {:else}
            <stop offset="0" stop-color="#34363b"></stop>
            <stop offset="1" stop-color="#1b1c1f"></stop>
        {/if}
    </radialGradient>
</defs>

<circle r={radius} cy={discs[0].sideY + 2} class="shadow"></circle>
{#each discs as disc, index (index)}
    <circle r={radius} cy={disc.sideY} class="side" class:light></circle>
    {#if disc.covered}
        <circle r={radius} cy={disc.faceY} class="gap" class:light></circle>
    {:else}
        <circle r={radius} cy={disc.faceY} fill="url(#gipf-face-{id})" class="face" class:light
        ></circle>
    {/if}
{/each}
{#if gipf}
    <circle r={radius * 0.55} cy={top.faceY} class="crown" class:light></circle>
{/if}

<style>
    .shadow {
        fill: rgb(0 0 0 / 0.3);
    }

    .side {
        fill: #4a4d54;
        stroke: #000;
        stroke-width: 1;
    }

    .side.light {
        fill: #a89f8c;
        stroke: #7d7564;
    }

    .face {
        stroke: #8a8e96;
        stroke-width: 1.2;
    }

    /* The lower disc's face, seen in the shadow beneath the raised top disc. */
    .gap {
        fill: #0b0c0e;
        stroke: #000;
        stroke-width: 1;
    }

    .gap.light {
        fill: #6f6858;
        stroke: #4f4a3e;
    }

    .crown {
        fill: none;
        stroke: rgb(255 255 255 / 0.4);
        stroke-width: 2;
    }

    .crown.light {
        stroke: rgb(0 0 0 / 0.28);
    }

    .face.light {
        stroke: #8d8676;
    }
</style>
