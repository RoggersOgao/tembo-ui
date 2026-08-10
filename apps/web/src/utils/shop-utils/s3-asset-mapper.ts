export function assetUrl(s3Key?: string | null): string {
    if (!s3Key) return "/placeholder-product.jpg"

    // If it's already a full URL (e.g. featuredImageUrl from a CDN), don't re-wrap it
    if (s3Key.startsWith("http://") || s3Key.startsWith("https://")) {
        return s3Key
    }

    const bucket = process.env.NEXT_PUBLIC_AWS_BUCKET ?? ""
    const region = process.env.NEXT_PUBLIC_AWS_REGION ?? ""

    return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`
}