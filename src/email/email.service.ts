import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async sendEmail(
        to: string,
        subject: string,
        html: string,
    ): Promise<void> {
        try {
            this.logger.log(`📧 Sending email to: ${to}`);

            await this.mailerService.sendMail({
                to,
                subject,
                html,
            });

            this.logger.log(`✅ Email sent successfully to: ${to}`);
        } catch (error) {
            this.logger.error(
                `❌ Failed to send email to: ${to}`,
                error?.stack || error,
            );

            // Optional: rethrow if caller should know it failed
            throw error;
        }
    }
}
