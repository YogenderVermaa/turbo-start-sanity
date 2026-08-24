import { defineType, defineField } from "sanity";

export const subscriber = defineType({
    name: "subscriber",
    type: "document",
    title: "Subscriber",
    fields: [
        defineField({
            name: "email",
            type: "string",
            title: "Email",
            description:"Subscriber's email address",
            validation : (rule) =>
             rule.required().email().error("A valid email address is required")
        }),
        defineField({
            name:"subscribedAt",
            type:"datetime",
            title:"Subscribed At",
            description:"Timestamp when the user subscribed",
            validation:(rule)=>rule.required(),
            initialValue:() => new Date().toISOString(),
        })
    ],
    preview: {
        select:{
            title:"email",
            subtitle:"subscribedAt"
        }
    }
    
})