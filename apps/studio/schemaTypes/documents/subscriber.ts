import { defineType,defineField } from "sanity"

export const author =  defineType({
    name:"author",
    type:"document",
    title:"Author",
    fields:[
        defineField({
            name:"email",
            type:"string",
            title:"Email",
            validation:(Rule) => Rule.required().email().error("A valid email address is required")
        }),
        defineField({
            name:"subscribedAt",
            type:"datetime",
            title:"Subscribed At",
            validation:(Rule)=>Rule.required(),
            initialValue:() => new Date().toISOString(),
        })
    ],
    
})