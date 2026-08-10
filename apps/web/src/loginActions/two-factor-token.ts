
// export const origin = process.env.NEXT_PUBLIC_API_BASE_URL

// export const getTwoFactorTokenByToken = async(token:string) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorToken?token=${token}`);
//         if (!res.ok) {
//             throw new Error("Failed to fetch data");
//         }
//         return res.json();
//     } catch (error) {
//         return { message: error };
//     }
// }

// // create two factor token

// export const createTwoFactorToken = async (data: { email: string; token: string; expires: Date }) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorToken`, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify(data),
//         });

//         if (!res.ok) {
//             const errorData = await res.json();
//             throw new Error(errorData.message || "Failed to create two-factor token");
//         }

//         return await res.json();
//     } catch (error: any) {
//         return { message: error.message || "An error occurred" };
//     }
// };


// export const deleteTwoFactorToken = async (tokenId: string) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorToken?id=${tokenId}`, {
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


// export const getTwoFactorTokenByEmail = async(email:string) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorToken?email=${email}`);
//         if (!res.ok) {
//             throw new Error("Failed to fetch data");
//         }
//         return res.json();
//     } catch (error) {
//         return { message: error };
//     }
// }