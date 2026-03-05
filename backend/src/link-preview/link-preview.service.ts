import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';

@Injectable()
export class LinkPreviewService {
    private readonly logger = new Logger(LinkPreviewService.name);

    async getPreview(url: string) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return null;
            }

            // Fetch the HTML content
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
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
            this.logger.error(`Error fetching link preview for ${url}`, error.message);
            return null;
        }
    }
}
