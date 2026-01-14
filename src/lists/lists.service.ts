import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { List } from './entities/list.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Subscriber } from '../subscribers/entities/subscriber.entity';
import { InjectKnex } from 'nestjs-knex';
import * as fs from 'fs';
import * as csv from 'fast-csv';
import { Knex } from 'knex';

@Injectable()
export class ListService {
  constructor(
    @InjectRepository(List)
    private listRepository: Repository<List>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Subscriber)
    private subscriberRepository: Repository<Subscriber>,
    @InjectKnex() private readonly knex: Knex,
  ) { }

  async create(createListDto: CreateListDto, organizationId: string) {
    const list = new List();
    list.name = createListDto.name;
    list.customFields = createListDto.customFields;

    if (createListDto.organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: createListDto.organizationId },
      });
      if (organization) {
        list.organization = organization;
      }
    }

    return this.listRepository.save(list);
  }

  findAll(organizationId: string) {
    return this.listRepository.find({ where: { organization: { id: organizationId } }, relations: ['organization'] });
  }

  async update(id: string, updateListDto: UpdateListDto, organizationId: string) {
    const list = await this.listRepository.findOne({
      where: {
        id,
        organization: { id: organizationId },
      },
    });
    if (!list) {
      throw new Error('List not found');
    }

    if (updateListDto.name) list.name = updateListDto.name;
    if (updateListDto.customFields)
      list.customFields = updateListDto.customFields;

    if (updateListDto.organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: updateListDto.organizationId },
      });
      if (organization) {
        list.organization = organization;
      }
    }
    return this.listRepository.save(list);
  }

  async importCsv(listId: string, filePath: string, organizationId: string) {
    // 1️⃣ Find list + organization
    const list = await this.listRepository.findOne({
      where: { id: listId },
      relations: ['organization'],
    });

    if (!list) throw new NotFoundException('List not found');
    if (!list.organization)
      throw new BadRequestException('List not linked to organization');

    const org = list.organization;

    const tempData: Partial<Subscriber>[] = [];
    const seenEmails = new Set<string>();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true, trim: true }))
        .on('error', (err) => {
          // 🔥 always cleanup file
          fs.unlinkSync(filePath);
          reject(err);
        })
        .on('data', (row) => {
          // ✅ Normalize email column (handles Email / EMAIL / BOM / spaces)
          const emailKey = Object.keys(row).find(
            (k) => k.trim().toLowerCase() === 'email',
          );

          const email = emailKey
            ? String(row[emailKey]).trim().toLowerCase()
            : null;

          // Skip invalid / empty email
          if (!email || !emailRegex.test(email)) return;

          // Skip duplicates inside same CSV
          if (seenEmails.has(email)) return;
          seenEmails.add(email);

          // Collect custom fields dynamically
          const customFields: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            if (key.trim().toLowerCase() !== 'email') {
              const value = row[key]?.toString().trim();
              if (value) customFields[key.trim()] = value;
            }
          }

          tempData.push({
            email,
            customFields,
            organization: org,
          });
        })
        .on('end', async () => {
          try {
            if (seenEmails.size === 0) {
              fs.unlinkSync(filePath);
              return resolve({
                totalCsvRows: 0,
                alreadyExisted: 0,
                newlyAdded: 0,
                skipped: 0,
                message: 'No valid emails found in CSV',
              });
            }

            // 2️⃣ Find existing subscribers (org-level)
            const existing = await this.subscriberRepository
              .createQueryBuilder('subscriber')
              .select('subscriber.email')
              .where('subscriber.organizationId = :orgId', {
                orgId: org.id,
              })
              .andWhere('subscriber.email IN (:...emails)', {
                emails: Array.from(seenEmails),
              })
              .getMany();

            const existingEmails = new Set(
              existing.map((s) => s.email.toLowerCase()),
            );

            // 3️⃣ Filter new subscribers
            const newSubscribers = tempData.filter(
              (s) => !existingEmails.has(s.email),
            );

            // Final dedupe safety
            const unique = new Map<string, Partial<Subscriber>>();
            for (const sub of newSubscribers) {
              unique.set(sub.email, sub);
            }

            const finalSubscribers = Array.from(unique.values());

            // 4️⃣ Save new subscribers
            if (finalSubscribers.length > 0) {
              const entities =
                this.subscriberRepository.create(finalSubscribers);
              await this.subscriberRepository.save(entities);
            }

            // 5️⃣ Cleanup file
            fs.unlinkSync(filePath);

            // 6️⃣ Response summary
            resolve({
              totalCsvRows: seenEmails.size,
              alreadyExisted: existingEmails.size,
              newlyAdded: finalSubscribers.length,
              skipped:
                seenEmails.size - finalSubscribers.length,
              message: `✅ Imported ${finalSubscribers.length} new subscribers. Skipped ${existingEmails.size} duplicates.`,
            });
          } catch (err) {
            fs.unlinkSync(filePath);
            reject(
              new BadRequestException(
                'Error processing CSV file',
              ),
            );
          }
        });
    });
  }

  // async importCsv(listId: string, filePath: string) {
  //   // Find list
  //   const list = await this.listRepository.findOne({
  //     where: { id: listId },
  //     relations: ['organization'],
  //   });
  //   if (!list) throw new NotFoundException('List not found');

  //   const org = list.organization;
  //   const tempData: Partial<Subscriber>[] = [];
  //   const seenEmails = new Set<string>();

  //   // Simple regex for email validation
  //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  //   return new Promise((resolve, reject) => {
  //     fs.createReadStream(filePath)
  //       .pipe(csv.parse({ headers: true }))
  //       .on('error', reject)
  //       .on('data', (row) => {
  //         const email = row.email?.trim().toLowerCase();

  //         // Skip invalid or empty emails
  //         if (!email || !emailRegex.test(email)) return;

  //         // Skip duplicates inside the same CSV file
  //         if (seenEmails.has(email)) return;
  //         seenEmails.add(email);

  //         // Dynamically collect all custom fields (except 'email')
  //         const customFields: Record<string, any> = {};
  //         for (const key of Object.keys(row)) {
  //           if (key.toLowerCase() !== 'email') {
  //             const value = row[key]?.trim();
  //             if (value) customFields[key] = value;
  //           }
  //         }

  //         // Collect valid subscriber data
  //         tempData.push({
  //           email,
  //           customFields,
  //           organization: org,
  //         });
  //       })
  //       .on('end', async () => {
  //         try {
  //           // Find existing emails from DB for this org
  //           const existing = await this.subscriberRepository
  //             .createQueryBuilder('subscriber')
  //             .select('subscriber.email')
  //             .where('subscriber.organizationId = :orgId', { orgId: org.id })
  //             .andWhere('subscriber.email IN (:...emails)', {
  //               emails: Array.from(seenEmails),
  //             })
  //             .getMany();

  //           const existingEmails = new Set(existing.map((s) => s.email.toLowerCase()));

  //           // Filter out emails already in DB
  //           const newSubscribers = tempData.filter(
  //             (s) => !existingEmails.has(s.email),
  //           );

  //           // also remove duplicates within same CSV again
  //           const seen = new Set();
  //           const finalSubscribers = newSubscribers.filter((s) => {
  //             if (seen.has(s.email)) return false;
  //             seen.add(s.email);
  //             return true;
  //           });

  //           // Bulk save only new ones
  //           if (finalSubscribers.length > 0) {
  //             const created = this.subscriberRepository.create(finalSubscribers);
  //             await this.subscriberRepository.save(created);
  //           }

  //           // Clean up uploaded file
  //           fs.unlinkSync(filePath);

  //           // Return summary
  //           resolve({
  //             totalCsvRows: seenEmails.size,
  //             alreadyExisted: existingEmails.size,
  //             newlyAdded: finalSubscribers.length,
  //             skipped: seenEmails.size - finalSubscribers.length,
  //             message: `✅ Imported ${finalSubscribers.length} new subscribers. Skipped ${existingEmails.size} duplicates.`,
  //           });
  //         } catch (err) {
  //           fs.unlinkSync(filePath);
  //           reject(new BadRequestException('Error processing CSV file.'));
  //         }
  //       });
  //   });
  // }

  async segmentSubscribers(listId: string, filters: Record<string, any>, organizationId: string) {
    // Find list + organization
    const list = await this.listRepository.findOne({
      where: { id: listId },
      relations: ['organization'],
    });

    if (!list) throw new NotFoundException('List not found');
    if (!list.organization) throw new BadRequestException('List not linked to organization');

    // Combine list-level filters + segmentation filters
    // (list.customFields = base filter)
    const combinedFilters = {
      ...(filters || {}),
      ...(list.customFields || {}),
    };

    // Build query
    const query = this.subscriberRepository
      .createQueryBuilder('subscriber')
      .where('subscriber.organizationId = :orgId', { orgId: list.organization.id });

    // Apply dynamic filters on customFields (JSON)
    for (const [key, value] of Object.entries(combinedFilters)) {
      query.andWhere(`subscriber.customFields ->> '${key}' = :value_${key}`, {
        [`value_${key}`]: value,
      });
    }

    // Execute query
    const results = await query.getMany();

    // Return filtered data
    return {
      total: results.length,
      filters,
      data: results,
    };
  }

  async getByCidTx(tx: Knex.Transaction, listCid: string) {
    try {
      console.log(listCid);
      const list = await tx('lists').where({ id: listCid }).first();
      console.log('list', list);
      if (!list) {
        throw new Error(`List with CID ${listCid} not found`);
      }
      // await this.enforceEntityPermissionTx(tx, context, 'list', list.id, 'view');
      return list;
    } catch (error) {
      console.error('Error fetching list by CID:', error);
      throw error;
    }
  }
  // async enforceEntityPermissionTx(tx: any, context: any, entityTypeId: string, entityId: any, requiredOperations: string) {
  //   if (!entityId) {
  //     throw new HttpError('Attendee Type Not Found', {}, HttpStatus.NOT_FOUND);
  //   }
  //   const result = await this._checkPermissionTx(tx, context, entityTypeId, entityId, requiredOperations);
  //   if (!result) {
  //     log.apply(`Denying permission ${entityTypeId}.${entityId} ${requiredOperations}`);
  //     throw new HttpError('Attendee Type Not Found', {}, HttpStatus.NOT_FOUND);
  //   }
  // }

  // async _checkPermissionTx(tx: any, context: any, entityTypeId: any, entityId: any, requiredOperations: any) {
  //   if (!context.user) {
  //     return false;
  //   }

  //   const entityType = entitySettings.getEntityType(entityTypeId);

  //   if (typeof requiredOperations === 'string') {
  //     requiredOperations = [requiredOperations];
  //   }

  //   requiredOperations = this.filterPermissionsByRestrictedAccessHandler(context, entityTypeId, entityId, requiredOperations, 'checkPermissions');

  //   if (requiredOperations.length === 0) {
  //     return false;
  //   }

  //   if (context.user.admin) { // This handles the getAdminContext() case. In this case we don't check the permission, but just the existence.
  //     const existsQuery = tx(entityType.entitiesTable);

  //     if (entityId) {
  //       existsQuery.where('id', entityId);
  //     }

  //     const exists = await existsQuery.first();

  //     return !!exists;

  //   } else {
  //     const permsQuery = tx(entityType.permissionsTable)
  //       .where('user', context.user.id)
  //       .whereIn('operation', requiredOperations);

  //     if (entityId) {
  //       permsQuery.andWhere('entity', entityId);
  //     }

  //     const perms = await permsQuery.first();

  //     return !!perms;
  //   }
  // }

  // filterPermissionsByRestrictedAccessHandler(context: any, entityTypeId: any, entityId: any, permissions: any, operationMsg: any) {
  //   if (context.user.restrictedAccessHandler) {
  //     const originalOperations = permissions;
  //     if (context.user.restrictedAccessHandler.permissions) {
  //       const entityPerms = context.user.restrictedAccessHandler.permissions[entityTypeId];

  //       if (!entityPerms) {
  //         permissions = [];
  //       } else if (entityPerms === true) {
  //         // no change to operations
  //       } else if (entityPerms instanceof Set) {
  //         permissions = permissions.filter(perm => entityPerms.has(perm));
  //       } else {
  //         if (entityId) {
  //           const allowedPerms = entityPerms[entityId];
  //           if (allowedPerms) {
  //             permissions = permissions.filter(perm => allowedPerms.has(perm));
  //           } else {
  //             const allowedPerms = entityPerms['default'];
  //             if (allowedPerms) {
  //               permissions = permissions.filter(perm => allowedPerms.has(perm));
  //             } else {
  //               permissions = [];
  //             }
  //           }
  //         } else {
  //           const allowedPerms = entityPerms['default'];
  //           if (allowedPerms) {
  //             permissions = permissions.filter(perm => allowedPerms.has(perm));
  //           } else {
  //             permissions = [];
  //           }
  //         }
  //       }
  //     } else {
  //       permissions = [];
  //     }
  //     log.verbose(operationMsg + ' with restrictedAccessHandler --  entityTypeId: ' + entityTypeId + '  entityId: ' + entityId + '  operations: [' + originalOperations + '] -> [' + permissions + ']');
  //   }

  //   return permissions;
  // }
  // async listTx(tx: any, listId: any) {
  //   return await tx('custom_fields').where({ list: listId }).select(['id', 'name', 'type', 'help', 'key', 'column', 'settings', 'group', 'default_value', 'required', 'order_list', 'order_subscribe', 'order_manage']).orderBy(knex.raw('-order_list'), 'desc').orderBy('id', 'asc');
  // }
  // async listGroupedTx(tx: any, listId: any) {
  //   const flds = await this.listTx(tx, listId);

  //   const fldsById = {};
  //   for (const fld of flds) {
  //     fld.settings = JSON.parse(fld.settings);

  //     fldsById[fld.id] = fld;

  //     if (fieldTypes[fld.type].grouped) {
  //       fld.settings.options = [];
  //       fld.groupedOptions = {};
  //     }
  //   }

  //   for (const fld of flds) {
  //     if (fld.group) {
  //       const group = fldsById[fld.group];
  //       group.settings.options.push({ key: fld.column, label: fld.name });
  //       group.groupedOptions[fld.column] = fld;
  //     }
  //   }

  //   const groupedFlds = flds.filter(fld => !fld.group);

  //   for (const fld of flds) {
  //     delete fld.group;
  //   }

  //   return groupedFlds;
  // }
}
