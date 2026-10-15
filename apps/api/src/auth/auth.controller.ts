import { Body, Controller, Get, HttpCode, Post, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard';
import { CsrfGuard } from './csrf.guard';
import { LoginDto } from './login.dto';
import { PasswordService } from './password.service';
import { User } from './user.schema';

@Controller('auth')
export class AuthController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
  ) {}

  @Get('csrf')
  csrf(@Req() req: Request) {
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
    return { csrfToken: req.session.csrfToken };
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const user = await this.users.findOne({ email: body.email.trim().toLowerCase() }).select('+passwordHash email role active sessionVersion');
    if (!user || !user.active || !(await this.passwords.verify(user.passwordHash, body.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.userId = user.id as string;
    req.session.sessionVersion = user.sessionVersion;
    req.session.csrfToken = randomBytes(32).toString('hex');
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return { user: { id: user.id, email: user.email, role: user.role }, csrfToken: req.session.csrfToken };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: Request) {
    const user = await this.users.findById(req.session.userId).select('email role').lean();
    if (!user) throw new UnauthorizedException();
    return { user: { id: String(user._id), email: user.email, role: user.role } };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
  }
}
