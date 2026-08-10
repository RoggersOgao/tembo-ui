
// export const origin = process.env.NEXT_PUBLIC_API_BASE_URL

// export const getPasswordResetTokenByEmail = async (email: string) => {
//     try {
//         const res = await fetch(`${origin}/api/passwordResetToken?email=${email}`);
//         if (!res.ok) {
//             throw new Error("Failed to fetch data");
//         }
//         return res.json();
//     } catch (error) {
//         return { message: error };
//     }
// };



// export const createPasswordResetToken = async (data: {
//     email: string;
//     token: string;
//     expires: Date
// }) => {
//     try {
//         const res = await fetch(`${origin}/api/passwordResetToken`, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//                 email: data.email,
//                 token: data.token,
//                 // Convert Date to ISO string for JSON transmission
//                 expires: data.expires
//             }),
//         });

//         if (!res.ok) {
//             const errorData = await res.json();
//             throw new Error(errorData.message || "Failed to create password reset token");
//         }

//         const result = await res.json();

//         // Convert expires back to Date object if it's a string
//         if (result.token && typeof result.token.expires === 'string') {
//             result.token.expires = new Date(result.token.expires);
//         }

//         return result.token;
//     } catch (error: any) {
//         console.error("Create password reset token error:", error);
//         throw new Error(error.message || "An error occurred while creating token");
//     }
// };


// export const deletePasswordResetToken= async (tokenId: string) => {
//     try {
//         const res = await fetch(`${origin}/api/passwordResetToken?id=${tokenId}`, {
//             method: "DELETE",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//         });

//         if (!res.ok) {
//             const errorData = await res.json();
//             throw new Error(errorData.message || "Failed to delete two-factor token");
//         }

//         return await res.json();
//     } catch (error: any) {
//         return { message: error.message || "An error occurred" };
//     }
// };

