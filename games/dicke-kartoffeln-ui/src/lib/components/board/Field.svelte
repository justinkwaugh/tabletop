<script lang="ts">
    import { PlanKind, type FieldState } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { FarmArea } from '$lib/utils/farmLayouts.js'
    import { TOKEN_IMAGES } from '$lib/utils/tokens.js'
    import Furrow from '../tokens/Furrow.svelte'
    import ImageTile from '../tokens/ImageTile.svelte'
    import PoisonCloud from '../tokens/PoisonCloud.svelte'
    import SeedBag from '../tokens/SeedBag.svelte'
    import Worms from '../tokens/Worms.svelte'

    let {
        field,
        area,
        scale,
        planning,
        ownerId
    }: {
        field: FieldState
        area: FarmArea
        scale: number
        planning: boolean
        ownerId: string
    } = $props()

    const gameSession = getGameSession()

    const width = $derived(area.width * scale)
    const height = $derived(area.height * scale)
    const tile = $derived(Math.min(width, height) * 0.25)

    const kind = $derived(planning ? gameSession.planKind : undefined)
    const target = $derived(planning && gameSession.fieldTargets.includes(field.id))
    const marked = $derived(planning && gameSession.marked(field.id))
    const wormChange = $derived(planning ? gameSession.draftWorms(field.id) : 0)

    const furrowPending = $derived(kind === PlanKind.Cultivate && marked)
    const seedPending = $derived(kind === PlanKind.Sow ? gameSession.sowing(field.id) : undefined)
    const seed = $derived(field.seed ?? seedPending)
    const fertilizerPending = $derived(
        kind === PlanKind.Fertilize && marked ? gameSession.fertilizerFor(field.id) : 0
    )
    const fertilizer = $derived(field.fertilizer + fertilizerPending)
    const poisonPending = $derived(kind === PlanKind.Spray && marked)
    const worms = $derived(field.worms + Math.min(0, wormChange))
    const dead = $derived(field.worms === 0)
</script>

<div
    id="dk-field-{field.id}-{ownerId}"
    class="field"
    style:left="{area.cx * scale - width / 2}px"
    style:top="{area.cy * scale - height / 2}px"
    style:width="{width}px"
    style:height="{height}px"
    style:transform="rotate({area.rotation}deg)"
>
    <!-- The farm lies turned a quarter clockwise; the field's contents turn back to read upright. -->
    <div class="upright" style:width="{height}px" style:height="{width}px">
        {#if field.furrow || furrowPending}
            <Furrow seed={field.id} aspect={width / height} pending={furrowPending} />
        {/if}
        <div class="crop" style:gap="{tile * 0.12}px">
            <div class="row top">
                <div class="flowers">
                    {#each { length: field.sunflowers }, index (index)}
                        <ImageTile src={TOKEN_IMAGES.sunflower} alt="Sunflower" size={tile * 0.9} />
                    {/each}
                </div>
                {#if field.skull}
                    <ImageTile src={TOKEN_IMAGES.skull} alt="Skull" size={tile * 0.9} dark />
                {/if}
            </div>
            <div class="row middle">
                {#if field.poison || poisonPending}
                    <PoisonCloud size={tile * 1.15} pending={poisonPending} />
                {/if}
                {#if seed}
                    <SeedBag
                        variety={seed}
                        size={tile * 1.3}
                        pending={seed === seedPending && !field.seed}
                    />
                {/if}
                {#each { length: fertilizer }, index (index)}
                    <ImageTile
                        src={TOKEN_IMAGES.fertilizer}
                        alt="Fertilizer"
                        size={tile * 1.05}
                        pending={index >= field.fertilizer}
                    />
                {/each}
            </div>
            <div class="row bottom">
                <Worms count={worms} size={tile} pending={Math.max(0, wormChange)} />
            </div>
        </div>
        {#if field.harvest !== undefined}
            <div class="harvest" style:font-size="{tile * 0.42}px">
                {field.harvest}
                {field.harvest === 1 ? 'sack' : 'sacks'}
            </div>
        {/if}
        {#if dead && !field.furrow}
            <div class="dead" style:font-size="{tile * 0.36}px">no worms – dead</div>
        {/if}
    </div>
    {#if target}
        <button
            type="button"
            class="target"
            aria-label="Field {field.id}"
            onclick={() => gameSession.clickField(field.id)}
        ></button>
    {/if}
</div>

<style>
    .field {
        position: absolute;
        transform-origin: center;
    }

    .upright {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-90deg);
    }

    .crop {
        position: absolute;
        inset: 6%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        pointer-events: none;
    }

    .row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4%;
    }

    .row.top {
        justify-content: space-between;
    }

    .flowers {
        display: flex;
        gap: 3px;
    }

    .harvest {
        position: absolute;
        right: 4%;
        bottom: 26%;
        border-radius: 6px;
        background: rgba(98, 62, 26, 0.92);
        padding: 1px 6px;
        color: #fff6dc;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        pointer-events: none;
    }

    .dead {
        position: absolute;
        left: 50%;
        top: 46%;
        transform: translateX(-50%);
        white-space: nowrap;
        border-radius: 4px;
        background: rgba(40, 30, 20, 0.6);
        padding: 0 4px;
        color: #f5ead2;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        pointer-events: none;
    }

    .target {
        position: absolute;
        inset: 0;
        cursor: pointer;
        border: 3px dashed #fff3a0;
        border-radius: 8px;
        background: rgba(255, 243, 160, 0.12);
        box-shadow: 0 0 14px rgba(255, 236, 120, 0.9);
    }

    .target:hover {
        background: rgba(255, 243, 160, 0.28);
    }
</style>
