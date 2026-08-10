"use client"
import React from "react";
import { BsExclamationTriangle } from "react-icons/bs"
import { motion} from 'framer-motion'
interface FormErrorProps{
    message?: string
}

export default function FormError({message}:FormErrorProps){
    if(!message) return null
    return(
        
        <motion.div
            initial={{
                opacity: 0,
                y: 20
            }}
            animate={{
                opacity: 1,
                y: 0
            }}
            exit={{
                opacity: 0,
                y: 20
            }}
        className="bg-destructive/15 p-3 rounded-md flex items-center gap-x-2 text-xs text-destructive fixed w-[36rem] bottom-10 right-3">
            <BsExclamationTriangle className="h-4 w-4" />
            <p>{message}</p>
        </motion.div>
        
    )
}