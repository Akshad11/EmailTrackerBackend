import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('tracker/analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get(':campaignId/geo')
    geo(@Param('campaignId') id: string) {
        return this.analyticsService.geo(id);
    }

    @Get(':campaignId/devices')
    devices(@Param('campaignId') id: string) {
        return this.analyticsService.devices(id);
    }

    @Get(':campaignId/timeline')
    timeline(
        @Param('campaignId') id: string,
        @Query('type') type: 'OPEN' | 'CLICK',
    ) {
        return this.analyticsService.timeline(id, type);
    }

    @Get(':campaignId/summary')
    summary(@Param('campaignId') id: string) {
        return this.analyticsService.summary(id);
    }
}
