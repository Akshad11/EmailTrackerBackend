import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';

import { Campaign } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

import { List } from '../lists/entities/list.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Subscriber } from '../subscribers/entities/subscriber.entity';

import { EmailService } from '../email/email.service';
import { ListService } from '../lists/lists.service';
import { TrackerService } from '../tracker/tracker.service';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,

    @InjectRepository(List)
    private readonly listRepository: Repository<List>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(Subscriber)
    private readonly subscriberRepository: Repository<Subscriber>,

    private readonly emailService: EmailService,
    private readonly listService: ListService,
    private readonly trackerService: TrackerService,

    @InjectKnex()
    private readonly knex: Knex,
  ) { }

  // =========================
  // CREATE CAMPAIGN (ORG SAFE)
  // =========================
  async createCampaign(
    dto: CreateCampaignDto,
    organizationId: string,
  ): Promise<Campaign> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const campaign = this.campaignRepository.create({
      subject: dto.subject,
      content: dto.content,
      organization,
    });

    if (dto.listId) {
      campaign.list = await this.listRepository.findOne({
        where: {
          id: dto.listId,
          organization: { id: organizationId },
        },
      });
    }

    return this.campaignRepository.save(campaign);
  }

  // =========================
  // LIST CAMPAIGNS (ORG SAFE)
  // =========================
  async listCampaigns(organizationId: string): Promise<Campaign[]> {
    return this.campaignRepository.find({
      where: {
        organization: { id: organizationId },
      },
      relations: ['list', 'organization'],
      order: { createdAt: 'DESC' },
    });
  }

  // =========================
  // UPDATE CAMPAIGN (ORG SAFE)
  // =========================
  async updateCampaign(
    id: string,
    dto: UpdateCampaignDto,
    organizationId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: {
        id,
        organization: { id: organizationId },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    Object.assign(campaign, dto);

    if (dto.listId) {
      campaign.list = await this.listRepository.findOne({
        where: {
          id: dto.listId,
          organization: { id: organizationId },
        },
      });
    }

    return this.campaignRepository.save(campaign);
  }

  // =========================
  // SEND CAMPAIGN (ORG SAFE)
  // =========================
  async sendCampaign(
    id: string,
    organizationId: string,
    filters?: Record<string, any>,
  ) {
    const campaign = await this.campaignRepository.findOne({
      where: {
        id,
        organization: { id: organizationId },
      },
      relations: ['organization', 'list'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const segmented = await this.listService.segmentSubscribers(
      campaign.list.id,
      filters || {},
      organizationId
    );

    const subscribers = segmented.data;

    if (!subscribers.length) {
      return { message: 'No subscribers matched filters' };
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      try {
        const htmlWithTracking =
          await this.trackerService.injectTracker(
            campaign.content,
            campaign,
            sub.id,
          );

        await this.emailService.sendEmail(
          sub.email,
          campaign.subject,
          htmlWithTracking,
        );

        sent++;
      } catch (err) {
        failed++;
      }
    }

    return {
      campaignId: campaign.id,
      organizationId,
      totalSubscribers: subscribers.length,
      sent,
      failed,
    };
  }

  // ==================================================
  // TRACKING SETTINGS (USED BY TRACKER / KNEX TX)
  // ==================================================
  async getTrackingSettingsByCidTx(
    tx: Knex.Transaction,
    cid: string,
  ) {
    const entity = await tx('campaigns')
      .where('campaigns.id', cid)
      .select([
        'campaigns.id',
        'campaigns.click_tracking_disabled',
        'campaigns.open_tracking_disabled',
      ])
      .first();

    if (!entity) {
      throw new NotFoundException(
        `Campaign with CID ${cid} not found`,
      );
    }

    return entity;
  }
}
