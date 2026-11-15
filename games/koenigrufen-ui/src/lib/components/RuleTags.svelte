<script lang="ts">
    // A bid's rule changes as small word tags ("No bonuses", "Bonuses ×2").
    import type { Tag } from '$lib/utils/bidRows.js'

    let { tags }: { tags: Tag[] } = $props()
</script>

<span class="tags">
    {#each tags as tag (tag.text)}
        <span class="tag {tag.tone}">{tag.text}</span>
    {/each}
</span>

<style>
    .tags {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .tag {
        padding: 0 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
    }

    .gold {
        background: rgb(242 201 76 / 0.2);
        color: #f2c94c;
    }

    .muted {
        background: rgb(241 231 207 / 0.12);
    }

    .warn {
        background: rgb(230 110 90 / 0.2);
        color: #f3a493;
    }
</style>
