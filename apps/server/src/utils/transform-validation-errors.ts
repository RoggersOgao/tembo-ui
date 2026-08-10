import { ApiError, ErrorCode, ValidationError } from "@repo/api-utils";

export const transformValidationErrors = (errors: ValidationError[]): ApiError[] => {
    return errors.map(error => ({
        code: error.code || ErrorCode.VALIDATION_ERROR,
        message: error.message,
        field: error.field
    }));
};