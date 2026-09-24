export interface WorkspaceTab {
    id: string
    label: string
    shortLabel?: string
    optional?: boolean
    closable?: boolean
}

export interface WorkspaceFixedPane {
    target: HTMLElement | undefined
    tabs: readonly string[]
    label: string
}
