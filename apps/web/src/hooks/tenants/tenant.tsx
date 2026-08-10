import { tenantSchema } from "@/lib/schemas"
import { z } from "zod"
const origin = process.env.NEXT_PUBLIC_API_BASE_URL

export  async function getTenants(){

    try{
        const res = await fetch(`${origin}/api/tenants`)
        if(!res.ok){
            throw new Error("Failed to fetch data!")
        }
        return res.json()
    }catch(error){
        return({"message":error})

    }
}

export async function createTenant(tenantData: z.infer<typeof tenantSchema >){
     try{
        const res = await fetch(`${origin}/api/tenants`, {
            method: "POST",
            headers:{
                "content-Type":"application/json",
            },
            body:JSON.stringify(tenantData)
        })
         if(res.status === 201){
             const data = await res.json()
             return { status: res.status, data: data,}
         }else{
            const data = await res.json()
             const errorMessage = res.status === 409 ? data.message: "something went wrong!"
             return{
                 message:errorMessage,
                 status:res.status
             }
         }
    }catch(error){
        return({"something went wrong!": error})
    }
}