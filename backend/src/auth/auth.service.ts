import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  id: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Still run a bcrypt compare against a dummy hash so responding to a
      // nonexistent account takes roughly the same time as a wrong-password
      // response on a real one — avoids the timing side-channel leaking
      // account existence.
      await bcrypt.compare(password, DUMMY_HASH);
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    return { id: user.id, email: user.email };
  }
}

// A bcrypt hash of an arbitrary string, cost 12 — used only to keep the
// no-such-user timing path consistent with the wrong-password path.
const DUMMY_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeOoBjHwn/RtR3Y.hoiJ1e0kFPjmz1D8u.';
