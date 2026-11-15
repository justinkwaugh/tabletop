<script lang="ts">
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import type { PublishedCardPlate } from '../session/eighteenXXSession.svelte.js'
    let { plate, compact = false }: { plate: PublishedCardPlate; compact?: boolean } = $props()
</script>

<!-- Sits under published card art, as wide as the card without widening it; compact, it stands beside the card. -->
<div class="plate" class:compact>
    {#if plate.tokens.length}<span class="tokens"
            >{#each plate.tokens as token, index (index)}<CompanyToken
                    appearance={token}
                    size={compact ? 28 : 36}
                />{/each}</span
        >{/if}
    <span>{plate.text}</span>
</div>

<style>
    .plate {
        box-sizing: border-box;
        width: 0;
        min-width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 10px;
        padding: 10px 14px;
        border-radius: 12px;
        background: #ece5d6;
        color: #2e2a24;
        font:
            italic 600 15px/1.3 Georgia,
            'Times New Roman',
            serif;
        text-align: left;
    }
    .plate.compact {
        flex-direction: column;
        flex-shrink: 0;
        width: 128px;
        min-width: 0;
        gap: 6px;
        margin-top: 0;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        text-align: center;
    }
    .tokens {
        display: flex;
        flex-shrink: 0;
        gap: 6px;
    }
    .compact .tokens {
        gap: 4px;
    }
</style>
