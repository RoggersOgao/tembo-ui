
/**
 * Validate if a string is a valid UserRole
 */
export function isValidUserRole(role: string): role is UserRole {
    return ["VIEWER", "TENANT", "LANDLORD", "AGENT", "MANAGER", "ARCHITECT"].includes(role);
}


/**
 * Get role-specific information message
 */
export function getRoleInfoMessage(role: UserRole): string | null {
    switch (role) {
        case "AGENT":
            return "Agents are required to register with an agency. You'll be asked to provide agency details in the next step.";
        case "MANAGER":
            return "Managers need to create or join an agency. You'll be asked to provide agency details in the next step.";
        default:
            return null;
    }
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
    const displayNames: Record<UserRole, string> = {
        VIEWER: "Viewer",
        LANDLORD: "Landlord",
        AGENT: "Agent",
        MANAGER: "Manager",
        ARCHITECT: "Architect"
    };
    return displayNames[role] || role;
}


// src/utils/registration-utils.ts

export type UserRole = "MANAGER" | "AGENT" | "ARCHITECT" | "LANDLORD" | "VIEWER";

/**
 * Determines if a role requires additional registration steps
 */
export function requiresAdditionalRegistration(role: UserRole): boolean {
  return role === "AGENT" || role === "MANAGER" || role === "LANDLORD";
}

/**
 * Determines if a role requires agency registration
 */
export function requiresAgencyRegistration(role: UserRole): boolean {
  return role === "AGENT" || role === "MANAGER";
}

/**
 * Determines if a role requires landlord-specific registration
 */
export function requiresLandlordRegistration(role: UserRole): boolean {
  return role === "LANDLORD";
}

/**
 * Get available roles for public registration
 */
export function getAvailableRoles() {
  return [
    { value: "VIEWER", label: "Viewer", description: "Browse properties" },
    { value: "ARCHITECT", label: "Architect", description: "Design and visualize properties" },
    { value: "LANDLORD", label: "Landlord", description: "Manage your properties" },
    { value: "AGENT", label: "Agent", description: "List and manage properties for clients" },
    { value: "MANAGER", label: "Manager", description: "Manage agency operations" },
  ];
}

/**
 * Get the next step based on role
 */
export function getNextStep(role: UserRole): "AGENCY_INFO" | "LANDLORD_INFO" | "COMPLETE" {
  if (requiresAgencyRegistration(role)) {
    return "AGENCY_INFO";
  }
  if (requiresLandlordRegistration(role)) {
    return "LANDLORD_INFO";
  }
  return "COMPLETE";
}

/**
 * Get role-specific info for display
 */
export function getRoleInfo(role: UserRole): {
  title: string;
  description: string;
  requirements: string[];
} {
  const roleInfo: Record<UserRole, {
    title: string;
    description: string;
    requirements: string[];
  }> = {
    AGENT: {
      title: "Real Estate Agent",
      description: "You'll need to provide your license information and agency details in the next step.",
      requirements: ["Valid realtor license", "Agency affiliation"],
    },
    MANAGER: {
      title: "Agency Manager",
      description: "You'll need to provide agency information in the next step.",
      requirements: ["Agency details", "Contact information"],
    },
    LANDLORD: {
      title: "Property Landlord",
      description: "You'll need to provide your landlord license information in the next step.",
      requirements: ["Landlord license", "Property information (optional)"],
    },
    ARCHITECT: {
      title: "Architect",
      description: "You can start designing and visualizing properties immediately after registration.",
      requirements: [],
    },
    VIEWER: {
      title: "Property Viewer",
      description: "You can start browsing properties immediately after registration.",
      requirements: [],
    },
  };

  return roleInfo[role];
}