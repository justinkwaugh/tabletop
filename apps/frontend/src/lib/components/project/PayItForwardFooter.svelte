<script lang="ts">
    import { ArrowRightOutline } from 'flowbite-svelte-icons'
</script>

<footer class="pay-it-forward-footer">
    <span>Free to play, always. Board Together takes no personal donations.</span>
    <a href="/pay-it-forward">Pay it forward <ArrowRightOutline class="h-3.5 w-3.5" /></a>
</footer>

<style>
    .pay-it-forward-footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
        margin-top: 48px;
        padding-top: 16px;
        border-top: 1px solid var(--color-gray-700);
        color: var(--color-gray-500);
        font-size: 13px;
    }
    a {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--color-blue-300);
    }
    a:hover {
        text-decoration: underline;
        text-underline-offset: 4px;
    }
</style>
