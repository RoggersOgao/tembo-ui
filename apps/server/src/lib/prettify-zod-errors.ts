import { z } from "zod";

export default function extractZodErrors(error: z.ZodError): string {
    return Object.entries(error.format())
        .map(([key, value]) => {
            const messages = (value as any)._errors || [];
            return messages.length > 0 ? `${key}: ${messages.join(", ")}` : null;
        })
        .filter(Boolean) // Remove null entries
        .join("\n");
}