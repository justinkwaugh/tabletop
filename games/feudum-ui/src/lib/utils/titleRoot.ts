/** The site marks the title's root `data-game-ui`, so a lookup never leaves the table. */
export function titleRootOf(node: Element): ParentNode {
    return node.closest('[data-game-ui]') ?? node.ownerDocument
}
