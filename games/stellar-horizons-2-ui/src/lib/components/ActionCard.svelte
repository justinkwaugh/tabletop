<script lang="ts">
    import type { Snippet } from 'svelte'

    let { children }: { children: Snippet } = $props()
</script>

<div class="slot">
    <div class="card">
        {@render children()}
    </div>
</div>

<style>
    .slot {
        padding: 8px 8px 0;
    }

    .card {
        border: 1px solid #2a3a57;
        border-radius: 14px;
        background: #0f1626;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
        padding: 6px 12px 8px;
    }
</style>
