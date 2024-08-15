export enum UpdateValidationResult {
    Proceed = 'proceed',
    Cancel = 'cancel'
}

export type UpdateValidator<T> = (existing: T, fieldsToUpdate: Partial<T>) => UpdateValidationResult
