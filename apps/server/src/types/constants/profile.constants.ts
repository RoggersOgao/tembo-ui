// // constants/profile.constants.ts
// import { Prisma } from '@repo/database';

// export const PROFILE_WITH_USER_INCLUDE = {
//   user: {
//     select: {
//       id: true,
//       name: true,
//       email: true,
//       phone: true,
//       image: true,
//       avatarUrl: true,
//       role: true,
//       isVerified: true,
//       verificationLevel: true,
//       trustScore: true,
//       createdAt: true,
//     }
//   },
//   _count: {
//     select: {
//       identityDocuments: true,
//       incomeDocuments: true,
//       referenceDocuments: true,
//       rentalHistory: true,
//       rentalReferences: true,
//     }
//   }
// } as const satisfies Prisma.ProfileInclude;

// // Infer type from actual Prisma query
// export type ProfileWithUser = Prisma.ProfileGetPayload<{
//   include: typeof PROFILE_WITH_USER_INCLUDE
// }>;