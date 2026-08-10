
/**
 * Ensures progress messages always include "percent"
 */
export function buildProgress(downloaded: number, total: number) {
    let percent = Math.floor((downloaded / total) * 100);

    // Avoid sending 0% in parallel mode
    if (percent <= 0) percent = 1;

    // Avoid sending 100% until the end
    if (percent >= 100) percent = 99;

    return percent;
}
