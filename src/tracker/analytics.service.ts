import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';

@Injectable()
export class AnalyticsService {
    constructor(@InjectKnex() private readonly knex: Knex) { }

    geo(campaignId: string) {
        return this.knex('tracker_events')
            .where({ campaignId })
            .select('country')
            .count('* as count')
            .groupBy('country');
    }

    devices(campaignId: string) {
        return this.knex('tracker_events')
            .where({ campaignId })
            .select('deviceType')
            .count('* as count')
            .groupBy('deviceType');
    }

    timeline(campaignId: string, type: 'OPEN' | 'CLICK') {
        return this.knex('tracker_events')
            .where({ campaignId, eventType: type })
            .select(
                this.knex.raw('DATE("createdAt") as date'),
                this.knex.raw('COUNT(*) as count'),
            )
            .groupByRaw('DATE("createdAt")')
            .orderBy('date', 'asc');
    }

    summary(campaignId: string) {
        return this.knex('tracker_events')
            .where({ campaignId })
            .select('eventType')
            .count('* as count')
            .groupBy('eventType');
    }
}
