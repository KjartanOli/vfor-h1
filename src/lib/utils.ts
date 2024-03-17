export function decodeHtmlEntities(encodedUrl: string): string {
    return encodedUrl.replace(/&#x2F;/g, '/');
}