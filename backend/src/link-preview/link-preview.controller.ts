import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';

@Controller('api/link-preview')
export class LinkPreviewController {
    constructor(private readonly linkPreviewService: LinkPreviewService) { }

    @Get()
    async getPreview(@Query('url') url: string) {
        if (!url) {
            throw new BadRequestException('URL is required');
        }

        try {
            new URL(url);
        } catch (e) {
            throw new BadRequestException('Invalid URL format');
        }

        const preview = await this.linkPreviewService.getPreview(url);
        if (!preview) {
            return { success: false };
        }

        return { success: true, preview };
    }
}
