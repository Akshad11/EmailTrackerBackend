import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectKnex, Knex } from 'nestjs-knex';

@Injectable()
export class HealthService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectKnex() private readonly knex: Knex,
    ) { }

    async check() {
        const dbStatus = await this.checkTypeOrm();
        const knexStatus = await this.checkKnex();

        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                api: 'up',
                database: dbStatus,
                analyticsDb: knexStatus,
            },
        };
    }

    private async checkTypeOrm() {
        try {
            await this.dataSource.query('SELECT 1');
            return 'up';
        } catch (error) {
            return 'down';
        }
    }

    private async checkKnex() {
        try {
            await this.knex.raw('SELECT 1');
            return 'up';
        } catch (error) {
            return 'down';
        }
    }
}
