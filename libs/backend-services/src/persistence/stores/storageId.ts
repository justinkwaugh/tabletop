export function isValidStorageId(id: string): boolean {
    return /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(id)
}
