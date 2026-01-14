import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { Subscriber } from './entities/subscriber.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';

@Injectable()
export class SubscriberService {
  constructor(
    @InjectRepository(Subscriber)
    private readonly subscriberRepository: Repository<Subscriber>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectKnex()
    private readonly knex: Knex,
  ) { }

  // =========================
  // CREATE (ORG SAFE)
  // =========================
  async create(
    dto: CreateSubscriberDto,
    organizationId: string,
  ) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const subscriber = this.subscriberRepository.create({
      email: dto.email,
      customFields: dto.customFields,
      organization,
    });

    return this.subscriberRepository.save(subscriber);
  }

  // =========================
  // LIST (ORG SAFE + PAGED)
  // =========================
  findAll(
    organizationId: string,
    page: number,
    limit: number,
  ) {
    return this.subscriberRepository.find({
      where: {
        organization: { id: organizationId },
      },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });
  }

  // =========================
  // UPDATE (ORG SAFE)
  // =========================
  async update(
    id: string,
    dto: UpdateSubscriberDto,
    organizationId: string,
  ) {
    const subscriber = await this.subscriberRepository.findOne({
      where: {
        id,
        organization: { id: organizationId },
      },
    });

    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }

    if (dto.email) subscriber.email = dto.email;
    if (dto.customFields)
      subscriber.customFields = dto.customFields;

    return this.subscriberRepository.save(subscriber);
  }

  // =========================
  // INTERNAL (USED BY TRACKER)
  // =========================
  async getByCidTx(
    tx: Knex.Transaction,
    listId: string,
    subscriptionCid: string,
  ) {
    return this._getByTx(tx, listId, 'id', subscriptionCid);
  }

  private async _getByTx(
    tx: Knex.Transaction,
    listId: string,
    key: string,
    value: string,
  ) {
    const subscription = await tx('subscribers')
      .where({ [key]: value })
      .first();

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with ${key} ${value} not found`,
      );
    }

    return subscription;
  }

  getSubscriptionTableName() {
    return `subscription`;
  }
}
