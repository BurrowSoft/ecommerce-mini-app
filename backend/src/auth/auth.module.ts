import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginRateLimiterService } from "./login-rate-limiter.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimiterService],
  exports: [LoginRateLimiterService],
})
export class AuthModule {}
