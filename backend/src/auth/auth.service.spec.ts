import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let service: AuthService;
  const password = 'correct-horse-battery-staple';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4); // low cost factor, just for fast tests
  });

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('returns the user on correct credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      passwordHash,
    });

    const result = await service.validateCredentials('a@example.com', password);

    expect(result).toEqual({ id: 1, email: 'a@example.com' });
  });

  it('returns null on wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      passwordHash,
    });

    const result = await service.validateCredentials(
      'a@example.com',
      'wrong-password',
    );

    expect(result).toBeNull();
  });

  it("returns null when the account doesn't exist, without distinguishing the error", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.validateCredentials(
      'nobody@example.com',
      password,
    );

    expect(result).toBeNull();
  });
});
