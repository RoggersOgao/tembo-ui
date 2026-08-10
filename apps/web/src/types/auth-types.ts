// Shared types only — no server imports, safe everywhere
export type UserRole =
    | "SUPER_ADMIN"
    | "ADMIN"
    | "MANAGER" // Operations / inventory manager
    | "STAFF" // Butcher / packer
    | "DELIVERY" // Delivery driver
    | "SUPPLIER" // Chicken supplier / vendor
    | "CUSTOMER"
    | "SUPPORT"
    | "VIEWER"