<script lang="ts">
    import { MAX_SUNFLOWERS, isGoodField, type FieldState } from '@tabletop/dicke-kartoffeln'
    import { TOKEN_IMAGES, VARIETY_LETTERS } from '$lib/utils/tokens.js'

    let { field }: { field: FieldState } = $props()

    const dead = $derived(field.worms === 0)
    const good = $derived(isGoodField(field))
    const title = $derived(
        [
            `Field ${field.id}: ${field.worms} ${field.worms === 1 ? 'worm' : 'worms'}`,
            `${field.sunflowers} of ${MAX_SUNFLOWERS} sunflowers`,
            good ? 'a good field' : '',
            dead ? 'dead' : '',
            field.skull ? 'skull' : '',
            field.seed ? `sown with ${field.seed}` : field.furrow ? 'ploughed' : '',
            field.fertilizer > 0 ? 'fertilized' : '',
            field.poison ? 'sprayed' : ''
        ]
            .filter((part) => part)
            .join(', ')
    )
</script>

<div class="field" class:dead class:good class:ploughed={field.furrow} {title}>
    <span class="id">{field.id}</span>
    {#if field.skull}<img class="skull" src={TOKEN_IMAGES.skull} alt="Skull" />{/if}
    <span class="worms"><img src={TOKEN_IMAGES.worm} alt="" />{field.worms}</span>
    <span class="flowers" aria-label="{field.sunflowers} sunflowers">
        {#each { length: MAX_SUNFLOWERS }, index (index)}
            <span class="flower" class:grown={index < field.sunflowers}></span>
        {/each}
    </span>
    <span class="marks">
        {#if field.seed}<span class="seed">{VARIETY_LETTERS[field.seed]}</span>{/if}
        {#if field.fertilizer > 0}<span class="chem">F</span>{/if}
        {#if field.poison}<span class="chem">P</span>{/if}
    </span>
</div>

<style>
    .field {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        min-width: 0;
        border: 2px solid #b9a581;
        border-radius: 6px;
        background: #f3ecd6;
        padding: 9px 2px 3px;
        line-height: 1;
    }

    .field.ploughed {
        background: repeating-linear-gradient(
            0deg,
            #e6d2b1 0 4px,
            #d9c09a 4px 6px
        );
    }

    .field.good {
        border-color: #4f7d2a;
        box-shadow: inset 0 0 0 1px #4f7d2a;
    }

    .field.dead {
        border-style: dashed;
        border-color: #8a1d1d;
        background: #e4ddd0;
    }

    .id {
        position: absolute;
        top: 1px;
        left: 4px;
        color: #6e5a3e;
        font-size: 11px;
    }

    .skull {
        position: absolute;
        top: 2px;
        right: 3px;
        width: 12px;
        height: 12px;
        border-radius: 2px;
        background: #161616;
        object-fit: contain;
    }

    .worms {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        font-size: 19px;
        font-weight: 700;
    }

    .worms img {
        height: 18px;
    }

    .dead .worms {
        color: #8a1d1d;
    }

    .flowers {
        display: flex;
        gap: 2px;
    }

    .flower {
        width: 8px;
        height: 8px;
        border: 1.5px solid #8c7a4c;
        border-radius: 50%;
    }

    .flower.grown {
        border-color: #6b4a00;
        background: #f2c629;
    }

    .marks {
        display: flex;
        gap: 2px;
        min-height: 14px;
    }

    .seed,
    .chem {
        min-width: 14px;
        border-radius: 999px;
        padding: 1px 3px 0;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
    }

    .seed {
        background: #6e3b1c;
        color: #fff6dc;
    }

    .chem {
        background: #8a1d1d;
        color: #fff6dc;
    }
</style>
