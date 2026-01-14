import { Injectable, ConflictException, NotFoundException, BadRequestException, ConsoleLogger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from './entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { isUUID } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { use } from 'passport';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) { }

  async create(createUserDto: CreateUserDto) {
    const { email, password, fullName, role, organizationName } = createUserDto;

    // 1. Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. Organization name is required
    if (!organizationName) {
      throw new BadRequestException('Organization name is required');
    }

    // 3. Create Organization
    const organization = this.organizationRepository.create({
      name: organizationName,
    });

    const savedOrganization =
      await this.organizationRepository.save(organization);

    // 4. Create User
    const user = this.userRepository.create({
      email,
      password: await bcrypt.hash(password, 10),
      fullName,
      role: UserRole.ADMIN,
      organization: savedOrganization,
    });
    const savedUser = await this.userRepository.save(user);

    // 5. Return response
    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        fullName: savedUser.fullName,
        role: savedUser.role,
      },
      organization: {
        id: savedOrganization.id,
        name: savedOrganization.name,
      },
    };
  }


  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['organization'], // ✅ THIS IS THE FIX
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findById(id: string): Promise<User> {
    if (!id) {
      throw new NotFoundException('Invalid ID parameter');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    id: string,
    updateUserDto: Partial<CreateUserDto>,
  ): Promise<User> {

    if (!isUUID(id)) {
      throw new BadRequestException('Invalid UUID format');
    }

    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!updateUserDto || Object.keys(updateUserDto).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      user.email = updateUserDto.email;
    }

    if (updateUserDto.fullName) {
      user.fullName = updateUserDto.fullName;
    }

    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }

    if (updateUserDto.organizationName) {
      const organization = await this.organizationRepository.findOne({
        where: { name: updateUserDto.organizationName },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      user.organization = organization;
    }

    return this.userRepository.save(user);
  }


  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }
}