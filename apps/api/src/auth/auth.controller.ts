import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, Post, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard';
import { CsrfGuard } from './csrf.guard';
import { ActivatePatientDto, LoginDto } from './login.dto';
import { PasswordService } from './password.service';
import { User } from './user.schema';
import { ConfigService } from '@nestjs/config';
import { requestBinding } from './session-binding.middleware';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get('csrf')
  csrf(@Req() req: Request) {
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
    return { csrfToken: req.session.csrfToken };
  }

  @ApiSecurity('csrf')
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
    const binding = requestBinding(req, this.config.getOrThrow<string>('SESSION_SECRET'), this.config.get<string>('RENDER') === 'true');
    req.session.clientSignature = binding.clientSignature;
    req.session.clientIpSignature = binding.clientIpSignature;
    req.session.clientAgentSignature = binding.clientAgentSignature;
    req.session.csrfToken = randomBytes(32).toString('hex');
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return { user: { id: user.id, email: user.email, role: user.role }, csrfToken: req.session.csrfToken };
  }

  @ApiSecurity('csrf')
  @Post('activate')
  @HttpCode(200)
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async activate(@Body() body: ActivatePatientDto) {
    // Password is hashed before the token is consumed to avoid burning valid tokens
    // when Argon2 fails. Token is claimed atomically; replay is rejected.
    const tokenHash = createHash('sha256').update(body.token).digest('hex');
    const now = new Date();
    const condition = {
      tokenHash, purpose: 'patient-invite', expiresAt: { $gt: now }, usedAt: { $exists: false },
    };
    const pending = await this.connection.db!.collection('AccountTokens').findOne(condition);
    if (!pending) throw new UnauthorizedException('Invalid or expired invitation');
    const hash = await this.passwords.hash(body.password);
    const token = await this.connection.db!.collection('AccountTokens').findOneAndUpdate(
      condition, { $set: { usedAt: new Date() } }, { returnDocument: 'before' });
    if (!token) throw new UnauthorizedException('Invalid or expired invitation');
    const result = await this.users.updateOne({
      _id: token.userId, role: 'patient', active: false, deletedAt: { $exists: false },
    }, { $set: { passwordHash: hash, active: true }, $inc: { sessionVersion: 1 } });
    if (!result.matchedCount) throw new UnauthorizedException('Invitation cannot be activated');
    await this.connection.db!.collection('AuditEvents').insertOne({
      action: 'patient.activated', patientId: token.userId, resourceId: token._id, createdAt: now,
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: Request) {
    const user = await this.users.findById(req.session.userId).select('email role').lean();
    if (!user) throw new UnauthorizedException();
    return { user: { id: String(user._id), email: user.email, role: user.role } };
  }

  @ApiSecurity('csrf')
  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
  }
}
