import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LoginRateLimiterService } from "./login-rate-limiter.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { CurrentUserId } from "./current-user.decorator";

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? "unknown";
    const rateLimit = this.rateLimiter.checkAndRecord(ip, dto.email);
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds ?? 60));
      res.status(429).json({
        statusCode: 429,
        message: "Too many login attempts. Please try again later.",
      });
      return;
    }

    const user = await this.authService.validateCredentials(dto.email, dto.password);
    if (!user) {
      // Deliberately generic — does not reveal whether the account exists.
      throw new UnauthorizedException("Invalid email or password");
    }

    // Regenerate the session id on login (not just reuse the pre-auth
    // session) to prevent session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.lastSeenAt = Date.now();
    await saveSession(req);

    return { email: user.email };
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(SessionAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await destroySession(req);
    // session.destroy() only removes the server-side session record — it
    // does not, by itself, clear the cookie in the browser. Without this,
    // the stale (now-meaningless) cookie stays present client-side, which
    // fooled the frontend's proxy.ts cookie-presence check into thinking
    // the user was still logged in until the next API call 401'd.
    res.clearCookie("connect.sid");
    return { message: "Logged out" };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  async me(@CurrentUserId() userId: number) {
    return { userId };
  }
}
