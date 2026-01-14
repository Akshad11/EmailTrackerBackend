import {
    Controller,
    Get,
    Param,
    Res,
    Req,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TrackerService } from './tracker.service';
import { TrackedLink } from './tracked_link.entity';

@Controller('tracker')
export class TrackerController {
    constructor(
        @InjectRepository(TrackedLink)
        private readonly trackedLinkRepo: Repository<TrackedLink>,
        private readonly trackerService: TrackerService,
    ) { }
    @Get('campaigns/:campaignId/links')
    async getCampaignLinks(
        @Param('campaignId') campaignId: string,
    ) {
        return this.trackedLinkRepo.find({
            where: { campaign: { id: campaignId } },
            order: { clicks: 'DESC' },
        });
    }

    @Get('click/:campaignId/:listId/:subscriberId/:slug')
    async trackClick(
        @Param() params,
        @Req() req,
        @Res() res: Response,
    ) {
        const link = await this.trackedLinkRepo.findOne({
            where: { slug: params.slug },
        });

        if (!link) {
            throw new HttpException('Invalid link', HttpStatus.NOT_FOUND);
        }

        await this.trackedLinkRepo.increment({ id: link.id }, 'clicks', 1);

        await this.trackerService.saveEvent(req, {
            campaignId: params.campaignId,
            listId: params.listId,
            subscriberId: params.subscriberId,
            trackedLinkId: link.id,
            eventType: 'CLICK',
        });

        return res.redirect(302, link.originalUrl);
    }

    // @Get('open/:campaignId/:listId/:subscriberId')
    // async trackOpen(
    //     @Param() params,
    //     @Req() req,
    //     @Res() res: Response,
    // ) {
    //     await this.trackerService.saveEvent(req, {
    //         campaignId: params.campaignId,
    //         listId: params.listId,
    //         subscriberId: params.subscriberId,
    //         eventType: 'OPEN',
    //     });

    //     return res.end(
    //         Buffer.from(
    //             'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    //             'base64',
    //         ),
    //     );
    // }

    @Get('open/:campaignId/:listId/:subscriberId')
    async trackOpen(
        @Param('campaignId') campaignId: string,
        @Param('listId') listId: string,
        @Param('subscriberId') subscriberId: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        // DO NOT BLOCK IMAGE RESPONSE
        this.trackerService
            .saveEvent(req, {
                campaignId,
                listId,
                subscriberId,
                eventType: 'OPEN',
            })
            .catch(() => { });

        console.log("worked");
        res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate',
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'image/gif');

        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64',
        );

        return res.status(200).send(pixel);
    }

    @Get('open/static/img')
    async trackOpenImg(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        // DO NOT BLOCK IMAGE RESPONSE
        let campaignId = "00001";
        let listId = "0001";
        let subscriberId = "000001";
        this.trackerService
            .saveEvent(req, {
                campaignId,
                listId,
                subscriberId,
                eventType: 'OPEN',
            })
            .catch(() => { });

        console.log("worked");
        res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate',
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'image/gif');

        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64',
        );

        return res.status(200).send(pixel);
    }
}
