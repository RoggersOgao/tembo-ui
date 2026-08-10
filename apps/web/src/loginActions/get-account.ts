// const origin = process.env.NEXT_PUBLIC_API_BASE_URL

// // TODO: MAKE THIS ROUTE DYMAIC FROM THE API... 
// export const getAccountByUserId = async (userId: string) => {
//     try {
//         const res = await fetch(`${origin}/api/account?userId=${userId}`);
//         if (!res.ok) {
//             throw new Error("Failed to fetch data");
//         }
//         return res.json();
//     } catch (error) {
//         return { message: error };
//     }
// }