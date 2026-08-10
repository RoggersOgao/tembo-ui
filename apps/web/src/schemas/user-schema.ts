
import * as z from "zod";
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  DELIVERY = 'DELIVERY',
  SUPPLIER = 'SUPPLIER',
  CUSTOMER = 'CUSTOMER',
  SUPPORT = 'SUPPORT',
  VIEWER = 'VIEWER',
}
export const NewPasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, { message: "Minimum 8 characters required!" })
            .regex(/[a-z]/, {
                message: "Password must contain at least one lowercase letter.",
            })
            .regex(/[A-Z]/, {
                message: "Password must contain at least one uppercase letter.",
            })
            .regex(/[0-9]/, {
                message: "Password must contain at least one number.",
            })
            .regex(/[\W_]/, {
                message:
                    "Password must contain at least one special character (e.g., !, @, #, $).",
            }),

        confirmPassword: z
            .string()
            .min(8, { message: "Minimum 8 characters required" })
            .regex(/[a-z]/, {
                message: "Password must contain at least one lowercase letter.",
            })
            .regex(/[A-Z]/, {
                message: "Password must contain at least one uppercase letter.",
            })
            .regex(/[0-9]/, {
                message: "Password must contain at least one number.",
            })
            .regex(/[\W_]/, {
                message:
                    "Password must contain at least one special character (e.g., !, @, #, $).",
            }),
    })
    // Custom validation to check that repeatPassword matches password
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match!",
        path: ["confirmPassword"], // point to the confirmPassword field for error
    });

export const ResetSchema = z.object({
    email: z.string().email({
        message: "The email provided is invalid!",
    }),
});

export const LoginSchema = z.object({
    email: z.string().email({
        message: "The email provided is invalid!",
    }),
    password: z.string().min(8, { message: "Minimum 8 characters required!" }),
    code: z.optional(z.string()),
});

export const RegisterSchema = z
    .object({
        email: z.string().email({
            message: "The email provided is invalid!",
        }),
        password: z
            .string()
            .min(8, { message: "Minimum 8 characters required!" })
            .regex(/[a-z]/, {
                message: "Password must contain at least one lowercase letter.",
            })
            .regex(/[A-Z]/, {
                message: "Password must contain at least one uppercase letter.",
            })
            .regex(/[0-9]/, {
                message: "Password must contain at least one number.",
            })
            .regex(/[\W_]/, {
                message:
                    "Password must contain at least one special character (e.g., !, @, #, $).",
            }),
        repeatPassword: z
            .string()
            .min(8, { message: "Minimum 8 characters required!" })
            .regex(/[a-z]/, {
                message: "Password must contain at least one lowercase letter.",
            })
            .regex(/[A-Z]/, {
                message: "Password must contain at least one uppercase letter.",
            })
            .regex(/[0-9]/, {
                message: "Password must contain at least one number.",
            })
            .regex(/[\W_]/, {
                message:
                    "Password must contain at least one special character (e.g., !, @, #, $).",
            }),
        name: z.string().min(1, {
            message: "Name is required!",
        }),
    })
    // Custom validation to check that repeatPassword matches password
    .refine((data) => data.password === data.repeatPassword, {
        message: "Passwords do not match!",
        path: ["repeatPassword"], // point to the repeatPassword field for error
    });

export const SettingsSchema = z
    .object({
        name: z.optional(z.string()),
        isTwoFactorEnabled: z.optional(z.boolean()),
        role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER', 'DELIVERY', 'SUPPLIER']),
        email: z.optional(z.string().min(6)),
        image: z.optional(z.string()),
        password: z.optional(z.string().min(6)),
        newPassword: z.optional(
            z
                .string()
                .min(8, { message: "Minimum 8 characters required!" })
                .regex(/[a-z]/, {
                    message:
                        "Password must contain at least one lowercase letter.",
                })
                .regex(/[A-Z]/, {
                    message:
                        "Password must contain at least one uppercase letter.",
                })
                .regex(/[0-9]/, {
                    message: "Password must contain at least one number.",
                })
                .regex(/[\W_]/, {
                    message:
                        "Password must contain at least one special character (e.g., !, @, #, $).",
                }),
        ),
    })
    .refine(
        (data) => {
            // If the password exists but the newPassword does not, return false (error)
            if (data.password && !data.newPassword) {
                return false;
            }
            return true; // If newPassword exists or password does not, validation passes
        },
        {
            message: "New password is required!",
            path: ["newPassword"], // Error on newPassword field
        },
    )
    .refine(
        (data) => {
            // If the newPassword exists but password does not, return false (error)
            if (data.newPassword && !data.password) {
                return false;
            }
            return true; // If password exists or newPassword does not, validation passes
        },
        {
            message: "Old password is required!",
            path: ["password"], // Error on password field
        },
    );

// user personalized notificaion schema..
//
//
export const UserNotificationSettingSchema = z.object({
    news: z.optional(z.boolean()),
    updates: z.optional(z.boolean()),
    userResearch: z.optional(z.boolean()),
    reminders: z.optional(z.boolean()),
});

export const UserSocialAccountsSchema = z.object({
    twitter: z.optional(z.boolean()),
    instagram: z.optional(z.boolean()),
    facebook: z.optional(z.boolean()),
    apple: z.optional(z.boolean()),
});

// posts schema
//
export const PostSchema = z.object({
    authorId: z.string().cuid().optional(), // UUID assumed for unique authorId
    title: z.string().min(1, "Title cannot be empty").optional(),
    slug: z.string().min(1, "Slug cannot be empty").optional(),
    coverImg: z.string().optional(),
    content: z.array(z.any()).min(1, "Content cannot be empty").optional(),
    published: z.boolean().default(false).optional(),
    publishedAt: z.date().optional(),
    categoryId: z.optional(z.string().cuid()), // UUID assumed for categoryId
});

export const CategorySchema = z.object({
    name: z.string().max(35, "Name cannot be empty"),
});

export const ContactFormSchema = z.object({
    name: z.string().min(2, {
        message: "Username must be at least 2 characters.",
    }),
    email: z.string().email(),
    message: z.string(),
});

export const NotificationSchema = z.object({
    notification: z.string().optional(),
    isRead: z.boolean().default(false).optional(),
    userId: z.string().cuid().optional(),
    postId: z.string().cuid().optional(),
    contactId: z.string().cuid().optional(),
});

export const DomainSchema = z.object({
    name: z
        .string()
        .min(4, { message: "A domain must have atleast 3 characters" })
        .refine(
            (value) =>
                /^((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,3}$/.test(
                    value ?? "",
                ),
            "This is not a valid domain",
        ),
    icon: z.string(),
    userId: z.string().cuid().optional(),
    campaignId: z.string().cuid().optional(),
});

export const ChatbotSchema = z.object({
    welcomeMessage: z.string().min(5).optional(),
    icon: z.string().optional(),
    botBackground: z.string().optional(),
    salesRepTitle: z.string().optional(),
    salesRepSubtitle: z.string().optional(),
    helpIcons: z.string().optional(),
    helpIconsText: z.string().optional(),
    rightBubble: z.string().optional(),
    rightBubbleText: z.string().optional(),
    leftBubble: z.string().optional(),
    leftBubbleText: z.string().optional(),
    inputText: z.string().optional(),
    helpdesk: z.boolean().default(false).optional(),
    domainId: z.string().cuid().optional(),
});

export const HelpDeskSchema = z.object({
    question: z.string().min(5),
    answer: z.string(),
    domainId: z.string().cuid(),
});

export const FilteredQuestionsSchema = z.object({
    question: z.string().min(5),
    answered: z.string(),
    domainId: z.string().cuid(),
});

// chat search schema
export const ChatSearchSchema = z.object({
    query: z.string().min(1, { message: "you must enter some search data" }),
    domain: z.string().min(1, { message: "You must select a domain" }),
});

export const ChatRoomSchema = z.object({
    live: z.boolean().default(false),
    mailed: z.boolean().default(false),
    customerId: z.string().cuid().optional(),
});

export const ChatMessageSchema = z.object({
    message: z.string(),
     role: z.nativeEnum(UserRole).optional(),
    chatRoomId: z.string().cuid().optional(),
    seen: z.boolean().default(false).optional(),
});

export const CustomerSchema = z.object({
    email: z.string(),
    domainId: z.string().cuid().optional(),
});

export const CustomerResponseSchema = z.object({
    question: z.string(),
    answer: z.string(),
    customerId: z.string().cuid().optional(),
});

export const BookingSchema = z.object({
    date: z.date(),
    slot: z.string(),
    email: z.string(),
    customerId: z.string().cuid(),
    domainId: z.string().cuid(),
});
export const CampaignSchema = z.object({
    name: z.string(),
    template: z.string(),
    userId: z.string().cuid(),
});

export const ProfileSchema = z.object({
    bio: z.string(),
    userId: z.string().cuid(),
});

export const ServerSchema = z.object({
    name: z
        .string()
        .min(1, { message: "Please provide a name for your server!" }),
    imageUrl: z.string().min(1, { message: "Server image is Required!" }),
    inviteCode: z.string().optional(),
    profileId: z.string().cuid().optional(),
});

export const MemberSchema = z.object({
    role: z.enum(["ADMIN", "MODERATOR", "GUEST"]),
    profileId: z.string().cuid().optional(),
    serverId: z.string().cuid().optional(),
});

export const ChannelSchema = z.object({
    name: z.string().min(1,{
        message: "Channel name is required!"
    }).refine(
        name => name.toLowerCase() !== 'general' ,{
            message: "The Channel name cannot be GENERAL"
        }
    ),
    type: z.enum(["TEXT", "AUDIO", "VIDEO"]).optional(),
    profileId: z.string().cuid().optional(),
    serverId: z.string().cuid().optional(),
});

export const InitChannelSchema = z.object({
    name: z.string().min(1,{
        message: "Channel name is required!"
    }),
    type: z.enum(["TEXT", "AUDIO", "VIDEO"]).optional(),
    profileId: z.string().cuid().optional(),
    serverId: z.string().cuid().optional(),
});


export const chatInputSchema = z.object({
    content:z.string().min(1, {
        message:"message cannot be empty"
    })
})

export const fileUploadSchema = z.object({
    fileUrl: z.string().min(1,{
        message: "file is required"
    })
})

export const MessagesSchema = z.object({
    content: z.string().min(1),
    fileUrl: z.string().optional()
})

export const EventSchema = z.object({
    profileId: z.string().cuid().min(1),
    serverId: z.string().cuid(),
    eventType:z.string().min(1),
    metadata: z.object({}).optional()

})