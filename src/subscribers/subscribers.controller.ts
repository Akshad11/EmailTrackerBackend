import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Query,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { SubscriberService } from './subscribers.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('subscribers')
export class SubscriberController {
  constructor(private readonly subscriberService: SubscriberService) { }

  @Post()
  create(@Body() dto: CreateSubscriberDto, @Req() req) {
    return this.subscriberService.create(
      dto,
      req.user.organizationID,
    );
  }

  @Get()
  findAll(
    @Req() req,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
  ) {
    return this.subscriberService.findAll(
      req.user.organizationID,
      page,
      limit,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriberDto,
    @Req() req,
  ) {
    return this.subscriberService.update(
      id,
      dto,
      req.user.organizationID,
    );
  }
}
