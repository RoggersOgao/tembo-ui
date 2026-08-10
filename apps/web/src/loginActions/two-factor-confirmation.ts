// export const origin = process.env.NEXT_PUBLIC_API_BASE_URL
// export const getTwoFactorConfirmationByUserId = async (userId: string) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorConfirmation?userId=${userId}`);
//         if (!res.ok) {
//             throw new Error("Failed to fetch data");
//         }
//         return res.json();
//     } catch (error) {
//         return { message: error };
//     }
// }

// export const createTwoFactorConfirmation = async (data: { userId: string }) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorConfirmation`, {
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

// export const deleteTwoFactorConfirmation = async (id: string) => {
//     try {
//         const res = await fetch(`${origin}/api/twoFactorConfirmation?id=${id}`, {
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
// }