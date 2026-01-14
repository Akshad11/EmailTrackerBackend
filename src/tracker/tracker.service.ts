import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as geoip from 'geoip-lite';
import * as UAParser from 'ua-parser-js';


import { Campaign } from '../campaigns/entities/campaign.entity';
import { TrackedLink } from './tracked_link.entity';
import { TrackerEvent } from './tracker_event.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrackerService {
    constructor(
        @InjectRepository(TrackedLink)
        private readonly trackedLinkRepo: Repository<TrackedLink>,

        @InjectRepository(TrackerEvent)
        private readonly trackerEventRepo: Repository<TrackerEvent>,

        private readonly config: ConfigService,
    ) { }

    // ===============================
    // 🔗 INJECT TRACKER
    // ===============================
    //     async injectTracker(
    //         html: string,
    //         campaign: Campaign,
    //         subscriberId: string,
    //     ): Promise<string> {
    //         const baseUrl = process.env.BASE_URL || 'http://localhost:8000/api';
    //         const urlRegex = /href="(https?:\/\/[^"]+)"/g;

    //         let updatedHtml = html;

    //         for (const match of html.matchAll(urlRegex)) {
    //             const originalUrl = match[1];
    //             const slug = randomBytes(6).toString('hex');

    //             await this.trackedLinkRepo.save(
    //                 this.trackedLinkRepo.create({
    //                     campaign,
    //                     originalUrl,
    //                     slug,
    //                 }),
    //             );

    //             updatedHtml = updatedHtml.replace(
    //                 originalUrl,
    //                 `${baseUrl}/tracker/click/${campaign.id}/${campaign.list.id}/${subscriberId}/${slug}`,
    //             );
    //         }

    //         const openPixel = `
    // <img src="${baseUrl}/tracker/open/${campaign.id}/${campaign.list.id}/${subscriberId}"
    //      width="1" height="1" style="display:none;" />`;

    //         return updatedHtml.includes('</body>')
    //             ? updatedHtml.replace('</body>', `${openPixel}</body>`)
    //             : updatedHtml + openPixel;
    //     }

    async injectTracker(
        html: string,
        campaign: Campaign,
        subscriberId: string,
    ): Promise<string> {
        const baseUrl = this.config.get<string>('BASE_URL');
        console.log(baseUrl);
        if (!baseUrl) {
            throw new Error('BASE_URL missing');
        }
        const urlRegex = /href=(["'])(https?:\/\/.*?)\1/g;
        let updatedHtml = html;

        for (const match of html.matchAll(urlRegex)) {
            const originalUrl = match[2];
            const slug = randomBytes(6).toString('hex');

            await this.trackedLinkRepo.save(
                this.trackedLinkRepo.create({
                    campaign,
                    originalUrl,
                    slug,
                }),
            );

            updatedHtml = updatedHtml.replace(
                originalUrl,
                `${baseUrl}/tracker/click/${campaign.id}/${campaign.list.id}/${subscriberId}/${slug}`,
            );
        }

        const openPixel = `
<img src="${baseUrl}/tracker/open/${campaign.id}/${campaign.list.id}/${subscriberId}?t=${Date.now()}"
     width="1" height="1" style="display:none;" />`;

        console.log(openPixel);
        return updatedHtml.includes('</body>')
            ? updatedHtml.replace('</body>', `${openPixel}</body>`)
            : updatedHtml + openPixel;
    }
    // ===============================
    // 📊 SAVE EVENT
    // ===============================
    async saveEvent(
        req: any,
        payload: {
            campaignId: string;
            listId: string;
            subscriberId: string;
            eventType: 'OPEN' | 'CLICK';
            trackedLinkId?: string;
        },
    ) {
        const geo = geoip.lookup(req.ip);
        const ua = new UAParser(req.headers['user-agent']).getResult();

        await this.trackerEventRepo.save({
            ...payload,
            ip: req.ip,
            country: geo?.country || null,
            deviceType: ua.device?.type || 'desktop',
            browser: ua.browser?.name || null,
            os: ua.os?.name || null,
        });
    }
}
