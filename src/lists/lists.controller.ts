import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListService } from './lists.service';
import { extname } from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListController {
  constructor(private readonly listService: ListService) { }

  @Post()
  create(@Body() dto: CreateListDto, @Req() req) {
    return this.listService.create(
      dto,
      req.user.organizationID,
    );
  }

  @Get()
  findAll(@Req() req) {
    return this.listService.findAll(
      req.user.organizationID,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListDto,
    @Req() req,
  ) {
    return this.listService.update(
      id,
      dto,
      req.user.organizationID,
    );
  }

  @Post(':listId/import-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/csv',
        filename: (req, file, cb) => {
          const filename =
            Date.now() + extname(file.originalname);
          cb(null, filename);
        },
      }),
    }),
  )
  async importCsv(
    @Param('listId') listId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.listService.importCsv(
      listId,
      file.path,
      req.user.organizationID,
    );
  }

  @Post(':listId/segment')
  async segmentSubscribers(
    @Param('listId') listId: string,
    @Body() filters: Record<string, any>,
    @Req() req,
  ) {
    return this.listService.segmentSubscribers(
      listId,
      filters,
      req.user.organizationID,
    );
  }
}
