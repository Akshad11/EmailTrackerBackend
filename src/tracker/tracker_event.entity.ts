import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('tracker_events')
export class TrackerEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    campaignId: string;

    @Column()
    listId: string;

    @Column()
    subscriberId: string;

    @Column({ nullable: true })
    trackedLinkId: string;

    @Column()
    eventType: 'OPEN' | 'CLICK';

    @Column({ nullable: true })
    ip: string;

    @Column({ nullable: true })
    country: string;

    @Column({ nullable: true })
    deviceType: string;

    @Column({ nullable: true })
    browser: string;

    @Column({ nullable: true })
    os: string;

    @CreateDateColumn()
    createdAt: Date;
}
