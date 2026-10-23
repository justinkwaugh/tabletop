<script lang="ts">
    import type { RolledDefenseFace } from '@tabletop/oath'
    import { defenseFaceImage } from '$lib/images/diceImages.js'
    import { plural } from '$lib/model/names.js'

    // R-5.5.4 — rolled defense faces, one die each, laid out by the row that holds them.
    let { faces }: { faces: readonly RolledDefenseFace[] } = $props()
</script>

{#each faces as face, index (index)}
    <span class="die">
        <img
            src={defenseFaceImage(face)}
            alt={face.doubling
                ? 'Doubles the shields rolled'
                : face.shields === 0
                  ? 'Blank'
                  : plural(face.shields, 'shield')}
        />
    </span>
{/each}

<style>
    .die {
        display: block;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        overflow: hidden;
        line-height: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .die img {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
