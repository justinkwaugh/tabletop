/** As `pointerenter`/`pointerleave`, which don't bubble, so Svelte adds a listener per element. */
export function crossesEdge({ currentTarget, relatedTarget }: PointerEvent): boolean {
    return !(
        currentTarget instanceof Node &&
        relatedTarget instanceof Node &&
        currentTarget.contains(relatedTarget)
    )
}
