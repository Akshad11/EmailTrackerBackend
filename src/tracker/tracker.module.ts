import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnexModule } from 'nestjs-knex';

import { TrackerService } from './tracker.service';
import { AnalyticsService } from './analytics.service';

import { TrackerController } from './tracker.controller';
import { AnalyticsController } from './analytics.controller';
import { TrackedLink } from './tracked_link.entity';
import { TrackerEvent } from './tracker_event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackedLink, TrackerEvent]),
    KnexModule,
  ],
  providers: [TrackerService, AnalyticsService],
  controllers: [TrackerController, AnalyticsController],
  exports: [TrackerService],
})
export class TrackerModule { }
