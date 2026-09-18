import { mount } from 'svelte'
import HistoryLoading from './HistoryLoading.fixture.svelte'

export function mountHistory(newestFirst: boolean) {
    mount(HistoryLoading, { target: document.body, props: { newestFirst } })
}
