import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Put,
  Req,
} from '@nestjs/common';
import { CampaignService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Post()
  async createCampaign(
    @Body() dto: CreateCampaignDto,
    @Req() req,
  ) {
    return this.campaignService.createCampaign(
      dto,
      req.user.organizationID,
    );
  }

  @Get()
  async listCampaigns(@Req() req) {
    return this.campaignService.listCampaigns(
      req.user.organizationID,
    );
  }

  @Put(':id')
  async updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @Req() req,
  ) {
    return this.campaignService.updateCampaign(
      id,
      dto,
      req.user.organizationID,
    );
  }

  @Post(':id/send')
  async sendCampaign(
    @Param('id') id: string,
    @Body() filters: Record<string, any>,
    @Req() req,
  ) {
    return this.campaignService.sendCampaign(
      id,
      req.user.organizationID,
      filters,
    );
  }
}
