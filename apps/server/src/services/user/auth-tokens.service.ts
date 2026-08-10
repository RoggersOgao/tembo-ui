import { db } from "@repo/database";
import { z } from "zod";
import crypto from "crypto";
import { TokenMethod } from "@repo/database";

// Import enums from Prisma schema
import {
  TokenMethod as TokenMethodEnum,
} from "@repo/database";
import { logger } from "@repo/logger";

// Schemas
export const PasswordTokenSchema = z.object({
  email: z.string().email(),
  token: z.string(),
  expires: z.coerce.date(),
  userId: z.string().cuid().optional(),
});

export const TwoFactorTokenSchema = z.object({
  email: z.string().email(),
  token: z.string(),
  expires: z.coerce.date(),
  userId: z.string().cuid(),
});

export const VerificationTokenSchema = z.object({
  email: z.string().email(),
  token: z.string(),
  expires: z.coerce.date(),
  userId: z.string().cuid(),
});

export const EmailChangeTokenSchema = z.object({
  userId: z.string().cuid(),
  token: z.string(),
  newEmail: z.string().email(),
  oldEmail: z.string().email().optional(),
  expiresAt: z.coerce.date(),
  ipAddress: z.string().ip().optional(),
});

export const PhoneChangeTokenSchema = z.object({
  userId: z.string().cuid(),
  token: z.string(),
  newPhone: z.string(),
  oldPhone: z.string().optional(),
  expiresAt: z.coerce.date(),
  ipAddress: z.string().ip().optional(),
  method: z.nativeEnum(TokenMethodEnum).default(TokenMethodEnum.SMS),
});

export const TwoFactorConfirmationSchema = z.object({
  userId: z.string().cuid(),
});

export class AuthTokensService {
  // Generate secure token
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate numeric token for SMS/Email
  static generateNumericToken(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  // Check if token is expired
  static isTokenExpired(expires: Date): boolean {
    return new Date() > expires;
  }

  // Password Reset Tokens
  // SERVICE
  static async getPasswordToken(token?: string, email?: string) {
    try {
      if (token) {
        const passwordToken = await db.passwordResetToken.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                isActive: true,
              }
            }
          }
        });

        if (!passwordToken) {
          return null;
        }

        if (this.isTokenExpired(passwordToken.expires)) {
          logger.info("Token found but expired, deleting", { tokenId: passwordToken.id });
          await db.passwordResetToken.delete({
            where: { id: passwordToken.id }
          });
          return null;
        }

        return passwordToken;

      } else if (email) {
        const tokens = await db.passwordResetToken.findMany({
          where: { email },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                isActive: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (tokens.length === 0) {
          logger.info("No tokens found for email", { email });
          return null;
        }

        logger.info("Tokens found for email", {
          email,
          total: tokens.length,
          tokens: tokens.map(t => ({
            id: t.id,
            expires: t.expires,
            createdAt: t.createdAt,
            isExpired: this.isTokenExpired(t.expires)
          }))
        });

        const validTokens = tokens.filter(t => !this.isTokenExpired(t.expires));
        const expiredTokens = tokens.filter(t => this.isTokenExpired(t.expires));

        if (expiredTokens.length > 0) {
          logger.info("Deleting expired tokens", {
            count: expiredTokens.length,
            ids: expiredTokens.map(t => t.id)
          });
          await db.passwordResetToken.deleteMany({
            where: { id: { in: expiredTokens.map(t => t.id) } }
          });
        }

        if (validTokens.length === 0) {
          logger.info("All tokens for email were expired", { email });
          return null;
        }

        return validTokens[0]; // most recent valid token
      }

      return null;

    } catch (error) {
      console.error("Error getting password token:", error);
      throw error;
    }
  }
  // SERVICE — looks up userId from email internally
  static async createPasswordToken(data: z.infer<typeof PasswordTokenSchema>) {
    const { email, token, expires } = data;

    // Look up user by email — no need for caller to pass userId
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, isActive: true }
    });

    if (!user) {
      throw new Error("User not found");
    }
    if (!user.isActive) {
      throw new Error("User account is not active");
    }

    await db.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    const passwordToken = await db.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
        userId: user.id, //  derived from lookup, not from caller
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    });

    return passwordToken;
  }

  static async deletePasswordToken(id: string) {
    await db.passwordResetToken.delete({
      where: { id },
    });
    return true;
  }

  static async deletePasswordTokensByUserId(userId: string) {
    await db.passwordResetToken.deleteMany({
      where: { userId }
    });
    return true;
  }

  // Two Factor Tokens
  static async getTwoFactorToken(token?: string, email?: string) {
    try {
      if (token) {
        const twoFactorToken = await db.twoFactorToken.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                isTwoFactorEnabled: true,
              }
            }
          }
        });

        // Check if token is expired
        if (twoFactorToken && this.isTokenExpired(twoFactorToken.expires)) {
          await db.twoFactorToken.delete({
            where: { id: twoFactorToken.id }
          });
          return null;
        }

        return twoFactorToken;
      } else if (email) {
        const tokens = await db.twoFactorToken.findMany({
          where: { email },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                isTwoFactorEnabled: true,
              }
            }
          },
          orderBy: { expires: 'desc' }
        });

        // Filter out expired tokens
        const validTokens = tokens.filter(token => !this.isTokenExpired(token.expires));

        // Delete expired tokens
        const expiredTokens = tokens.filter(token => this.isTokenExpired(token.expires));
        if (expiredTokens.length > 0) {
          await db.twoFactorToken.deleteMany({
            where: {
              id: { in: expiredTokens.map(t => t.id) }
            }
          });
        }

        return validTokens.length > 0 ? validTokens[0] : null;
      }
      return null;
    } catch (error) {
      console.error("Error getting two-factor token:", error);
      throw error;
    }
  }

  static async createTwoFactorToken(data: z.infer<typeof TwoFactorTokenSchema>) {
    const { email, token, expires, userId } = data;

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId, email },
      select: { id: true, isActive: true, isTwoFactorEnabled: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("User account is not active");
    }

    // Delete any existing tokens for this user
    await db.twoFactorToken.deleteMany({
      where: { userId }
    });

    const twoFactorToken = await db.twoFactorToken.create({
      data: {
        email,
        token,
        expires,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isTwoFactorEnabled: true,
          }
        }
      }
    });

    return twoFactorToken;
  }

  static async deleteTwoFactorToken(id: string) {
    await db.twoFactorToken.delete({
      where: { id },
    });
    return true;
  }

  static async deleteTwoFactorTokensByUserId(userId: string) {
    await db.twoFactorToken.deleteMany({
      where: { userId }
    });
    return true;
  }

  // Verification Tokens
  static async getVerificationToken(token?: string, email?: string) {
    try {
      if (token) {
        const verificationToken = await db.verificationToken.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                emailVerified: true,
              }
            }
          }
        });

        // Check if token is expired
        if (verificationToken && this.isTokenExpired(verificationToken.expires)) {
          await db.verificationToken.delete({
            where: { id: verificationToken.id }
          });
          return null;
        }

        return verificationToken;
      } else if (email) {
        const tokens = await db.verificationToken.findMany({
          where: { email },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                emailVerified: true,
              }
            }
          },
          orderBy: { expires: 'desc' }
        });

        // Filter out expired tokens
        const validTokens = tokens.filter(token => !this.isTokenExpired(token.expires));

        // Delete expired tokens
        const expiredTokens = tokens.filter(token => this.isTokenExpired(token.expires));
        if (expiredTokens.length > 0) {
          await db.verificationToken.deleteMany({
            where: {
              id: { in: expiredTokens.map(t => t.id) }
            }
          });
        }

        return validTokens.length > 0 ? validTokens[0] : null;
      }
      return null;
    } catch (error) {
      console.error("Error getting verification token:", error);
      throw error;
    }
  }

  static async createVerificationToken(data: z.infer<typeof VerificationTokenSchema>) {
    const { email, token, expires, userId } = data;

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId, email },
      select: { id: true, isActive: true, emailVerified: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("User account is not active");
    }

    if (user.emailVerified) {
      throw new Error("Email is already verified");
    }

    // Delete any existing tokens for this user
    await db.verificationToken.deleteMany({
      where: { userId }
    });

    const verificationToken = await db.verificationToken.create({
      data: {
        email,
        token,
        expires,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
          }
        }
      }
    });

    return verificationToken;
  }

  static async deleteVerificationToken(id: string) {
    await db.verificationToken.delete({
      where: { id },
    });
    return true;
  }

  static async deleteVerificationTokensByUserId(userId: string) {
    await db.verificationToken.deleteMany({
      where: { userId }
    });
    return true;
  }

  // Email Change Tokens
  static async getEmailChangeToken(token?: string, userId?: string) {
    try {
      if (token) {
        const emailChangeToken = await db.emailChangeToken.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              }
            }
          }
        });

        // Check if token is expired
        if (emailChangeToken && this.isTokenExpired(emailChangeToken.expiresAt)) {
          await db.emailChangeToken.delete({
            where: { id: emailChangeToken.id }
          });
          return null;
        }

        return emailChangeToken;
      } else if (userId) {
        const tokens = await db.emailChangeToken.findMany({
          where: { userId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              }
            }
          },
          orderBy: { expiresAt: 'desc' }
        });

        // Filter out expired tokens
        const validTokens = tokens.filter(token => !this.isTokenExpired(token.expiresAt));

        // Delete expired tokens
        const expiredTokens = tokens.filter(token => this.isTokenExpired(token.expiresAt));
        if (expiredTokens.length > 0) {
          await db.emailChangeToken.deleteMany({
            where: {
              id: { in: expiredTokens.map(t => t.id) }
            }
          });
        }

        return validTokens.length > 0 ? validTokens[0] : null;
      }
      return null;
    } catch (error) {
      console.error("Error getting email change token:", error);
      throw error;
    }
  }

  static async createEmailChangeToken(data: z.infer<typeof EmailChangeTokenSchema>) {
    const { userId, token, newEmail, oldEmail, expiresAt, ipAddress } = data;

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, email: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("User account is not active");
    }

    // Check if new email is already in use
    const existingUser = await db.user.findUnique({
      where: { email: newEmail }
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("Email is already in use by another account");
    }

    // Delete any existing tokens for this user
    await db.emailChangeToken.deleteMany({
      where: { userId }
    });

    const emailChangeToken = await db.emailChangeToken.create({
      data: {
        userId,
        token,
        newEmail,
        oldEmail: oldEmail || user.email,
        expiresAt,
        ipAddress,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    });

    return emailChangeToken;
  }

  static async deleteEmailChangeToken(id: string) {
    await db.emailChangeToken.delete({
      where: { id },
    });
    return true;
  }

  // Phone Change Tokens
  static async getPhoneChangeToken(token?: string, userId?: string) {
    try {
      if (token) {
        const phoneChangeToken = await db.phoneChangeToken.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
              }
            }
          }
        });

        // Check if token is expired
        if (phoneChangeToken && this.isTokenExpired(phoneChangeToken.expiresAt)) {
          await db.phoneChangeToken.delete({
            where: { id: phoneChangeToken.id }
          });
          return null;
        }

        return phoneChangeToken;
      } else if (userId) {
        const tokens = await db.phoneChangeToken.findMany({
          where: { userId },
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
              }
            }
          },
          orderBy: { expiresAt: 'desc' }
        });

        // Filter out expired tokens
        const validTokens = tokens.filter(token => !this.isTokenExpired(token.expiresAt));

        // Delete expired tokens
        const expiredTokens = tokens.filter(token => this.isTokenExpired(token.expiresAt));
        if (expiredTokens.length > 0) {
          await db.phoneChangeToken.deleteMany({
            where: {
              id: { in: expiredTokens.map(t => t.id) }
            }
          });
        }

        return validTokens.length > 0 ? validTokens[0] : null;
      }
      return null;
    } catch (error) {
      console.error("Error getting phone change token:", error);
      throw error;
    }
  }

  static async createPhoneChangeToken(data: z.infer<typeof PhoneChangeTokenSchema>) {
    const { userId, token, newPhone, oldPhone, expiresAt, ipAddress, method } = data;

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, phone: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("User account is not active");
    }

    // Check if new phone is already in use
    const existingUser = await db.user.findUnique({
      where: { phone: newPhone }
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("Phone number is already in use by another account");
    }

    // Delete any existing tokens for this user
    await db.phoneChangeToken.deleteMany({
      where: { userId }
    });

    const phoneChangeToken = await db.phoneChangeToken.create({
      data: {
        userId,
        token,
        newPhone,
        oldPhone: oldPhone || user.phone,
        expiresAt,
        ipAddress,
        method,
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
          }
        }
      }
    });

    return phoneChangeToken;
  }

  static async deletePhoneChangeToken(id: string) {
    await db.phoneChangeToken.delete({
      where: { id },
    });
    return true;
  }

  // Two Factor Confirmations
  static async getTwoFactorConfirmation(userId: string) {
    try {
      const confirmation = await db.twoFactorConfirmation.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isTwoFactorEnabled: true,
              twoFactorConfirmedAt: true,
            }
          }
        }
      });

      return confirmation;
    } catch (error) {
      console.error("Error getting two-factor confirmation:", error);
      throw error;
    }
  }

  static async createTwoFactorConfirmation(userId: string) {
    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, isTwoFactorEnabled: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("User account is not active");
    }

    if (!user.isTwoFactorEnabled) {
      throw new Error("Two-factor authentication is not enabled for this user");
    }

    // Delete any existing confirmation for this user
    await db.twoFactorConfirmation.deleteMany({
      where: { userId }
    });

    const confirmation = await db.twoFactorConfirmation.create({
      data: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isTwoFactorEnabled: true,
          }
        }
      }
    });

    // Update user's twoFactorConfirmedAt timestamp
    await db.user.update({
      where: { id: userId },
      data: { twoFactorConfirmedAt: new Date() }
    });

    return confirmation;
  }

  static async deleteTwoFactorConfirmation(id: string) {
    await db.twoFactorConfirmation.delete({
      where: { id },
    });
    return true;
  }

  static async deleteTwoFactorConfirmationByUserId(userId: string) {
    await db.twoFactorConfirmation.deleteMany({
      where: { userId }
    });

    // Clear twoFactorConfirmedAt on user
    await db.user.update({
      where: { id: userId },
      data: { twoFactorConfirmedAt: null }
    });

    return true;
  }

  // Bulk cleanup operations
  static async cleanupExpiredTokens() {
    const now = new Date();

    // Delete all expired tokens
    const [passwordTokens, twoFactorTokens, verificationTokens, emailChangeTokens, phoneChangeTokens] = await Promise.all([
      db.passwordResetToken.deleteMany({
        where: { expires: { lt: now } }
      }),
      db.twoFactorToken.deleteMany({
        where: { expires: { lt: now } }
      }),
      db.verificationToken.deleteMany({
        where: { expires: { lt: now } }
      }),
      db.emailChangeToken.deleteMany({
        where: { expiresAt: { lt: now } }
      }),
      db.phoneChangeToken.deleteMany({
        where: { expiresAt: { lt: now } }
      })
    ]);

    return {
      passwordTokens: passwordTokens.count,
      twoFactorTokens: twoFactorTokens.count,
      verificationTokens: verificationTokens.count,
      emailChangeTokens: emailChangeTokens.count,
      phoneChangeTokens: phoneChangeTokens.count,
      total: passwordTokens.count + twoFactorTokens.count + verificationTokens.count + emailChangeTokens.count + phoneChangeTokens.count
    };
  }

  // Get all tokens for a user
  static async getUserTokens(userId: string) {
    const [
      passwordTokens,
      twoFactorTokens,
      verificationTokens,
      emailChangeTokens,
      phoneChangeTokens,
      twoFactorConfirmation
    ] = await Promise.all([
      db.passwordResetToken.findMany({
        where: { userId },
        orderBy: { expires: 'desc' }
      }),
      db.twoFactorToken.findMany({
        where: { userId },
        orderBy: { expires: 'desc' }
      }),
      db.verificationToken.findMany({
        where: { userId },
        orderBy: { expires: 'desc' }
      }),
      db.emailChangeToken.findMany({
        where: { userId },
        orderBy: { expiresAt: 'desc' }
      }),
      db.phoneChangeToken.findMany({
        where: { userId },
        orderBy: { expiresAt: 'desc' }
      }),
      db.twoFactorConfirmation.findUnique({
        where: { userId }
      })
    ]);

    return {
      passwordResetTokens: passwordTokens,
      twoFactorTokens: twoFactorTokens,
      verificationTokens: verificationTokens,
      emailChangeTokens: emailChangeTokens,
      phoneChangeTokens: phoneChangeTokens,
      twoFactorConfirmation: twoFactorConfirmation
    };
  }

  // Delete all tokens for a user
  static async deleteAllUserTokens(userId: string) {
    await Promise.all([
      db.passwordResetToken.deleteMany({ where: { userId } }),
      db.twoFactorToken.deleteMany({ where: { userId } }),
      db.verificationToken.deleteMany({ where: { userId } }),
      db.emailChangeToken.deleteMany({ where: { userId } }),
      db.phoneChangeToken.deleteMany({ where: { userId } }),
      db.twoFactorConfirmation.deleteMany({ where: { userId } })
    ]);

    // Clear twoFactorConfirmedAt on user
    await db.user.update({
      where: { id: userId },
      data: { twoFactorConfirmedAt: null }
    });

    return true;
  }

  // verify backup code for mfa
  static async verifyBackupCode(userId: string, backupCode: string) {
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.backupCodes.includes(backupCode)) {
      return null;
    }
    // Remove the used backup code
    await db.user.update({
      where: { id: userId },
      data: {
        backupCodes: {
          set: user.backupCodes.filter(code => code !== backupCode)
        }
      }
    });

    return user;
  }

  // Verify and consume token (for all token types)
  static async verifyAndConsumeToken(type: 'password' | 'twoFactor' | 'verification' | 'emailChange' | 'phoneChange', token: string, userId?: string) {
    let tokenRecord: any = null;

    switch (type) {
      case 'password':
        tokenRecord = await this.getPasswordToken(token);
        if (tokenRecord) {
          await this.deletePasswordToken(tokenRecord.id);
        }
        break;

      case 'twoFactor':
        tokenRecord = await this.getTwoFactorToken(token);
        if (tokenRecord) {
          await this.deleteTwoFactorToken(tokenRecord.id);
        }
        break;

      case 'verification':
        tokenRecord = await this.getVerificationToken(token);
        if (tokenRecord) {
          await this.deleteVerificationToken(tokenRecord.id);
        }
        break;

      case 'emailChange':
        tokenRecord = await this.getEmailChangeToken(token);
        if (tokenRecord) {
          await this.deleteEmailChangeToken(tokenRecord.id);

          // Update user email if token is valid
          if (tokenRecord.userId && tokenRecord.newEmail) {
            await db.user.update({
              where: { id: tokenRecord.userId },
              data: {
                email: tokenRecord.newEmail,
                emailVerified: null // Reset verification when email changes
              }
            });
          }
        }
        break;

      case 'phoneChange':
        tokenRecord = await this.getPhoneChangeToken(token);
        if (tokenRecord) {
          await this.deletePhoneChangeToken(tokenRecord.id);

          // Update user phone if token is valid
          if (tokenRecord.userId && tokenRecord.newPhone) {
            await db.user.update({
              where: { id: tokenRecord.userId },
              data: {
                phone: tokenRecord.newPhone,
                phoneVerified: false // Reset verification when phone changes
              }
            });
          }
        }
        break;
    }

    if (!tokenRecord) {
      throw new Error(`Invalid or expired ${type} token`);
    }

    // Verify user ID if provided
    if (userId && tokenRecord.userId !== userId) {
      throw new Error("Token does not belong to the specified user");
    }

    return {
      valid: true,
      userId: tokenRecord.userId,
      email: tokenRecord.email || tokenRecord.newEmail,
      phone: tokenRecord.phone || tokenRecord.newPhone,
      type
    };
  }
}