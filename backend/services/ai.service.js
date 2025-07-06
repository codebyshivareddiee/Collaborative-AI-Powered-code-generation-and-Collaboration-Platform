import { GoogleGenerativeAI } from "@google/generative-ai"

// Debug: Check if API key is loaded
console.log("GOOGLE_AI_KEY loaded:", process.env.GOOGLE_AI_KEY ? "YES" : "NO");
console.log("GOOGLE_AI_KEY length:", process.env.GOOGLE_AI_KEY ? process.env.GOOGLE_AI_KEY.length : 0);
console.log("GOOGLE_AI_KEY starts with:", process.env.GOOGLE_AI_KEY ? process.env.GOOGLE_AI_KEY.substring(0, 10) + "..." : "NOT SET");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
console.log(genAI)
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
    },
    systemInstruction: `You are an expert in MERN and Development. You have an experience of 10 years in the development. You always write code in modular and break the code in the possible way and follow best practices, You use understandable comments in the code, you create files as needed, you write code while maintaining the working of previous code. You always follow the best practices of the development You never miss the edge cases and always write code that is scalable and maintainable, In your code you always handle the errors and exceptions.
    
    Examples: 

    <example>
 
    response: {

    "text": "this is you fileTree structure of the express server",
    "fileTree": {
        "app.js": {
            file: {
                contents: "
                const express = require('express');

                const app = express();


                app.get('/', (req, res) => {
                    res.send('Hello World!');
                });


                app.listen(3000, () => {
                    console.log('Server is running on port 3000');
                })
                "
            
        },
    },

        "package.json": {
            file: {
                contents: "

                {
                    "name": "temp-server",
                    "version": "1.0.0",
                    "main": "index.js",
                    "scripts": {
                        "test": "echo \"Error: no test specified\" && exit 1"
                    },
                    "keywords": [],
                    "author": "",
                    "license": "ISC",
                    "description": "",
                    "dependencies": {
                        "express": "^4.21.2"
                    }
}

                
                "
                
                

            },

        },

    },
    "buildCommand": {
        mainItem: "npm",
            commands: [ "install" ]
    },

    "startCommand": {
        mainItem: "node",
            commands: [ "app.js" ]
    }
}

    user:Create an express application 
   
    </example>


    
       <example>

       user:Hello 
       response:{
       "text":"Hello, How can I help you today?"
       }
       
       </example>
    
 IMPORTANT : don't use file name like routes/index.js
       
       
    `
});

export const generateResult = async (prompt) => {
    try {
        console.log("Generating AI response for prompt:", prompt);
        const result = await model.generateContent(prompt);
        console.log("AI response generated successfully");
        return result.response.text();
    } catch (error) {
        console.error("AI Service Error:", error.message);
        console.error("Error details:", error);
        throw error;
    }
}