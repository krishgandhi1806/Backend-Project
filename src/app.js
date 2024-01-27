import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
const app= express();


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

// For accepting JSON data
app.use(express.json({limit: "16kb"}));

// For URL configurations
app.use(express.urlencoded({extended: true, limit: "16kb"}));

// For storing static files
app.use(express.static("public"));

// For performing CRUD operations on Cookies
app.use(cookieParser());

// Routes Import
import userRouter from "./routes/user.routes.js"


// Routes declaration
app.use("/api/v1/users", userRouter);


export {app};