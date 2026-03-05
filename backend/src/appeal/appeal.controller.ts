// backend/src/appeal/appeal.controller.ts
import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AppealService } from './appeal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('appeals')
@UseGuards(JwtAuthGuard)
export class AppealController {
    constructor(private readonly appealService: AppealService) { }

    // ---------------------------------------------------------------
    // POST /appeals — Submit a new appeal (banned user only)
    // ---------------------------------------------------------------
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async submitAppeal(
        @Req() req: any,
        @Body() body: { reason: string },
    ) {
        const username = req.user?.username;
        return this.appealService.submitAppeal(username, body.reason);
    }

    // ---------------------------------------------------------------
    // GET /appeals/me — Check own appeal status
    // ---------------------------------------------------------------
    @Get('me')
    async getMyAppeal(@Req() req: any) {
        const username = req.user?.username;
        return this.appealService.getMyAppeal(username);
    }

    // ---------------------------------------------------------------
    // GET /appeals?status=pending — List appeals (admin only)
    // ---------------------------------------------------------------
    @Get()
    async getAppeals(
        @Req() req: any,
        @Query('status') status?: string,
    ) {
        const username = req.user?.username;
        return this.appealService.getAppeals(username, status);
    }

    // ---------------------------------------------------------------
    // GET /appeals/:id — Get single appeal detail (admin only)
    // ---------------------------------------------------------------
    @Get(':id')
    async getAppeal(@Req() req: any, @Param('id') id: string) {
        const username = req.user?.username;
        return this.appealService.getAppeal(id, username);
    }

    // ---------------------------------------------------------------
    // PATCH /appeals/:id/review — Review/decide on an appeal (admin only)
    // Body: { decision: 'approved' | 'rejected', adminNote?: string }
    // ---------------------------------------------------------------
    @Patch(':id/review')
    async reviewAppeal(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { decision: 'approved' | 'rejected'; adminNote?: string },
    ) {
        const username = req.user?.username;
        return this.appealService.reviewAppeal(id, username, body.decision, body.adminNote);
    }
}
