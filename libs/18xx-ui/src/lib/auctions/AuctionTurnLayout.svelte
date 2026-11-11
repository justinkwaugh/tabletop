<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        content,
        turn,
        turnFirstWhenStacked = false
    }: { content: Snippet; turn?: Snippet; turnFirstWhenStacked?: boolean } = $props()
</script>

<div class="frame">
    <div class="layout" class:turn-first={turnFirstWhenStacked}>
        {@render content()}
        {#if turn}<div class="turn">{@render turn()}</div>{/if}
    </div>
</div>

<style>
    .frame {
        width: 100%;
        container: auction-turn / inline-size;
    }
    .layout {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px 36px;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        flex: 0 0 200px;
    }
    @container auction-turn (max-width: 719px) {
        .layout {
            flex-direction: column;
        }
        .turn {
            flex-basis: auto;
            align-items: center;
            text-align: center;
        }
        .turn:not(:has(*)) {
            display: none;
        }
        .turn-first .turn {
            order: -1;
        }
    }
</style>
