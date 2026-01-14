import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) { }

  @Post('send')
  async sendEmail(
    @Body() body: { campaignid: string, to: string; subject: string; text: string },
  ) {
    const { campaignid, to, subject, text } = body;

    try {
      // await this.emailService.sendEmail(campaignid, to, subject, text);

      return {
        success: true,
        message: `Email sent successfully to ${to}`,
      };
    } catch (error) {
      // Log real error for debugging
      console.error('EMAIL SEND ERROR:', error);

      // Send clean error response to client
      throw new HttpException(
        {
          success: false,
          message: 'Failed to send email',
          error: error?.message || 'Unknown email error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
