import { writable, type Readable, type Writable } from 'svelte/store'

export class RuneBackedStore<T> implements Readable<T> {
    private store: Writable<T>
    private read: () => T

    constructor(read: () => T) {
        this.read = read
        this.store = writable(this.read())
    }

    subscribe = (run: (value: T) => void) => this.store.subscribe(run)

    connect() {
        $effect(() => {
            this.store.set(this.read())
        })
    }
}
