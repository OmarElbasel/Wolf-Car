import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditTrail } from '../activity/audit-trail.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { generatePassword } from '../common/crypto';
import type { AuthUser } from '../common/types';
import type { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateUsername } from '../users/username';
import type { IssuedCredentials } from '../users/users.types';
import type { CreateBranchDto, StaffDto, UpdateBranchDto } from './dto/branches.dto';

const STAFF_SELECT = { id: true, username: true, displayName: true, email: true, isActive: true, role: true } as const;

const BRANCH_SELECT = {
  id: true,
  code: true,
  name: true,
  nameAr: true,
  isActive: true,
  createdAt: true,
  users: { where: { deletedAt: null }, select: STAFF_SELECT },
} as const;

type BranchRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
  createdAt: Date;
  users: { id: string; username: string; displayName: string; email: string | null; isActive: boolean; role: Role }[];
};

function branchView(b: BranchRow) {
  const staff = (role: Role) => {
    const u = b.users.find((x) => x.role === role);
    return u ? { id: u.id, username: u.username, displayName: u.displayName, email: u.email, isActive: u.isActive } : null;
  };
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    nameAr: b.nameAr,
    isActive: b.isActive,
    createdAt: b.createdAt,
    manager: staff('BRANCH_MANAGER'),
    cashier: staff('CASHIER'),
  };
}

export type BranchView = ReturnType<typeof branchView>;

interface NewStaff extends StaffDto {
  role: Role;
  password: string;
  showroomPassword: string;
  passwordHash: string;
  showroomPasswordHash: string;
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly trail: AuditTrail,
  ) {}

  async list(): Promise<BranchView[]> {
    const rows = await this.prisma.branch.findMany({ select: BRANCH_SELECT, orderBy: { code: 'asc' } });
    return rows.map(branchView);
  }

  options() {
    return this.prisma.branch.findMany({
      select: { id: true, code: true, name: true, nameAr: true, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async get(id: string): Promise<BranchView> {
    const row = await this.prisma.branch.findUnique({ where: { id }, select: BRANCH_SELECT });
    if (!row) throw new NotFoundException('Branch not found.');
    return branchView(row);
  }

  /**
   * Creates the branch together with its only manager and cashier (the
   * database checks at commit that both exist) and adds every catalogue
   * product to the branch's showroom order.
   */
  async create(dto: CreateBranchDto, actor: AuthUser): Promise<{ branch: BranchView; credentials: IssuedCredentials[] }> {
    const staff = await Promise.all([this.prepare(dto.manager, 'BRANCH_MANAGER'), this.prepare(dto.cashier, 'CASHIER')]);

    const { branchId, credentials } = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: { code: dto.code, name: dto.name, nameAr: dto.nameAr } });
      const credentials: IssuedCredentials[] = [];
      for (const s of staff) {
        const user = await tx.user.create({
          data: {
            username: await generateUsername(tx, s.role, branch.code),
            displayName: s.displayName,
            email: s.email ?? null,
            role: s.role,
            branchId: branch.id,
            passwordHash: s.passwordHash,
            showroomPasswordHash: s.showroomPasswordHash,
            createdById: actor.id,
          },
        });
        credentials.push({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          branchCode: branch.code,
          password: s.password,
          showroomPassword: s.showroomPassword,
        });
      }
      const products = await tx.product.findMany({ select: { id: true }, orderBy: { name: 'asc' } });
      if (products.length) {
        await tx.branchProduct.createMany({
          data: products.map((p, position) => ({ branchId: branch.id, productId: p.id, position })),
        });
      }
      return { branchId: branch.id, credentials };
    });

    const branch = await this.get(branchId);
    this.trail.setEntity('Branch', branchId).setBranch(branchId).setChange(null, branch);
    return { branch, credentials };
  }

  async update(id: string, dto: UpdateBranchDto): Promise<BranchView> {
    const before = await this.get(id);
    await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    const after = await this.get(id);
    this.trail.setEntity('Branch', id).setBranch(id).setChange(before, after);
    return after;
  }

  /**
   * Replaces the branch's manager or cashier in one transaction: the current
   * account is retired (soft-deleted, sessions revoked) and a new one created.
   */
  async replaceStaff(
    branchId: string,
    role: 'BRANCH_MANAGER' | 'CASHIER',
    dto: StaffDto,
    actor: AuthUser,
  ): Promise<{ branch: BranchView; credentials: IssuedCredentials }> {
    const before = await this.get(branchId);
    const current = role === 'BRANCH_MANAGER' ? before.manager : before.cashier;
    const s = await this.prepare(dto, role);

    const created = await this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.user.update({ where: { id: current.id }, data: { deletedAt: new Date(), isActive: false } });
        await this.tokens.revokeUserSessions(current.id, 'replaced', {}, tx);
      }
      return tx.user.create({
        data: {
          username: await generateUsername(tx, role, before.code),
          displayName: s.displayName,
          email: s.email ?? null,
          role,
          branchId,
          passwordHash: s.passwordHash,
          showroomPasswordHash: s.showroomPasswordHash,
          createdById: actor.id,
        },
      });
    });

    const branch = await this.get(branchId);
    this.trail
      .setEntity('Branch', branchId)
      .setBranch(branchId)
      .setChange({ [role]: current }, { [role]: role === 'BRANCH_MANAGER' ? branch.manager : branch.cashier });
    return {
      branch,
      credentials: {
        userId: created.id,
        username: created.username,
        displayName: created.displayName,
        role,
        branchCode: before.code,
        password: s.password,
        showroomPassword: s.showroomPassword,
      },
    };
  }

  private async prepare(dto: StaffDto, role: Role): Promise<NewStaff> {
    const password = generatePassword();
    const showroomPassword = generatePassword();
    const [passwordHash, showroomPasswordHash] = await Promise.all([
      this.passwords.hash(password),
      this.passwords.hash(showroomPassword),
    ]);
    return { displayName: dto.displayName, email: dto.email, role, password, showroomPassword, passwordHash, showroomPasswordHash };
  }
}
