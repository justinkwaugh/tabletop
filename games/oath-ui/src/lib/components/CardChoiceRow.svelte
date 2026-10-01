<script lang="ts">
    import type { Snippet } from 'svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import type { CardChoice } from '$lib/model/cardChoice.js'

    // Every card-valued choice is a row of cards: tap to pick, tap a picked card to untap it,
    // and hover or hold to enlarge.
    let {
        choices,
        picked,
        onpick,
        busy = false,
        height = 90,
        under
    }: {
        choices: readonly CardChoice[]
        picked: readonly string[]
        onpick: (key: string) => void
        busy?: boolean
        height?: number
        under?: Snippet<[CardChoice]>
    } = $props()
</script>

<div class="flex flex-wrap gap-2">
    {#each choices as choice (choice.key)}
        {@const on = picked.includes(choice.key)}
        <div class="flex flex-col items-center gap-0.5">
            <button
                type="button"
                class="rounded-[5px] {on
                    ? 'ring-2 ring-oath-accent'
                    : 'ring-1 ring-oath-control-hover hover:ring-oath-accent'}"
                aria-pressed={on}
                title={choice.label}
                disabled={busy}
                onclick={() => onpick(choice.key)}
            >
                <CardImage
                    cardId={choice.cardId}
                    back={choice.back}
                    width={widthAtHeight(height, choice)}
                    label={choice.label}
                    inspect
                />
            </button>
            {#if choice.caption}
                <span class="max-w-[7rem] text-center text-[10px] leading-tight text-oath-text-muted"
                    >{choice.caption}</span
                >
            {/if}
            {#if under}{@render under(choice)}{/if}
        </div>
    {/each}
</div>
