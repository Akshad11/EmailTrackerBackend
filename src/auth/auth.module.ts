import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../users/users.module';
import { RolesGuard } from './roles.guard';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    forwardRef(() => UserModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, RolesGuard, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard, JwtModule],
})
export class AuthModule { }
