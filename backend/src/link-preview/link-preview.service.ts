import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

@Injectable()
export class LinkPreviewService {
    private readonly logger = new Logger(LinkPreviewService.name);
    private readonly privateHostnames = new Set(['localhost', '127.0.0.1', '::1']);

    private isPrivateIpv4(address: string): boolean {
        const parts = address.split('.').map(Number);
        if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
        if (parts[0] === 10) return true;
        if (parts[0] === 127) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        return false;
    }

    private isPrivateIpv6(address: string): boolean {
        const normalized = address.toLowerCase();
        return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
    }

    private isPrivateAddress(address: string): boolean {
        const ipVersion = isIP(address);
        if (ipVersion === 4) return this.isPrivateIpv4(address);
        if (ipVersion === 6) return this.isPrivateIpv6(address);
        return false;
    }

    private async isBlockedHost(hostname: string): Promise<boolean> {
        const normalizedHost = hostname.toLowerCase();
        if (this.privateHostnames.has(normalizedHost) || normalizedHost.endsWith('.local')) {
            return true;
        }

        if (this.isPrivateAddress(normalizedHost)) {
            return true;
        }

        try {
            const addresses = await lookup(normalizedHost, { all: true, verbatim: true });
            return addresses.some(({ address }) => this.isPrivateAddress(address));
        } catch {
            return true;
        }
    }

    async getPreview(url: string) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return null;
            }

            if (await this.isBlockedHost(parsedUrl.hostname)) {
                return null;
            }

            // Fetch the HTML content
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                redirect: 'error',
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
                return null;
            }

            // Only fetch if it's text/html to save bandwidth and prevent parsing binary files
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/html')) {
                return null;
            }

            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;

            const getMeta = (property: string) => {
                const el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
                return el ? el.getAttribute('content') : null;
            };

            const title = getMeta('og:title') || document.title || null;
            const description = getMeta('og:description') || getMeta('description') || null;
            const image = getMeta('og:image') || null;

            let finalImageUrl = image;
            if (image && !image.startsWith('http')) {
                try {
                    finalImageUrl = new URL(image, url).href;
                } catch (e) { }
            }

            if (!title && !description && !image) {
                return null;
            }

            return {
                url,
                title,
                description,
                image: finalImageUrl,
                siteName: getMeta('og:site_name') || parsedUrl.hostname
            };
        } catch (error) {
            this.logger.error(
                `Error fetching link preview for ${url}`,
                error instanceof Error ? error.message : String(error),
            );
            return null;
        }
    }
}
