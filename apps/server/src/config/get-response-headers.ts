export function getResponseHeaders(origin: string | null): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": origin || "",
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
  