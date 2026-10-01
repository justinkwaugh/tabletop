<script lang="ts">
    import RailBanners from '$lib/components/RailBanners.svelte'
    import RailEndDie from '$lib/components/RailEndDie.svelte'
    import RailGoals from '$lib/components/RailGoals.svelte'
</script>

<div class="rail">
    <RailGoals />
    <RailBanners />
    <RailEndDie />
</div>

<style>
    .rail {
        display: flex;
        align-items: stretch;
        gap: 48px;
        height: 100%;
        padding: 16px 40px;
        background: var(--oath-surface);
        border-top: 2px solid var(--oath-frame);
        color: var(--oath-text);
    }
</style>
