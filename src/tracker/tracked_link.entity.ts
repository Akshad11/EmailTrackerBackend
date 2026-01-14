import { Campaign } from 'src/campaigns/entities/campaign.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from 'typeorm';

@Entity('tracked_links')
export class TrackedLink {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
    campaign: Campaign;

    @Column({ type: 'text' })
    originalUrl: string;

    @Column({ type: 'varchar', length: 100 })
    slug: string; // used in tracking URL

    @Column({ default: 0 })
    clicks: number;

    @CreateDateColumn()
    createdAt: Date;
}
