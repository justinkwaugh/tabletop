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
        background: linear-gradient(180deg, rgba(28, 25, 23, 0.96), rgba(12, 10, 9, 0.98));
        border-top: 2px solid rgba(180, 140, 80, 0.4);
        color: #e7e5e4;
    }
</style>
