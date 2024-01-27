import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"

import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefreshTokens= async(userId) =>{
    try{
        const user= await User.findById(userId);
        const accessToken= user.generateAccessToken();
        const refreshToken= user.generateRefreshToken();

        user.refreshToken= refreshToken;
        await user.save({ validateBeforeSave: false });

        return {accessToken, refreshToken};

    }catch(error){
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}


const registerUser= asyncHandler(async (req, res) =>{
    // Get user details from frontend

    const {fullName, email, username, password} =req.body

    // Validation - not empty
    // if(fullName === ""){
    //     throw new ApiError(400, "Full Name is required")
    // }

    if(
        [fullName, email, username, password].some((field) => field?.trim()==="")
    ){
        throw new ApiError(400, "All fields are Compulsory")
    }
    

    // Check if user already exists: username, email

    const existedUser= await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with this email or username already exists")
    }

    // Check for images, check for avatar

    const avatarLocalPath= req.files?.avatar[0]?.path;
    // const coverImageLocalPath= req.files?.coverImage[0].path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath= req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar File is required");
    }

    // Upload them to cloudinary, avatar check

    const avatar= await uploadOnCloudinary(avatarLocalPath);

    const coverImage= await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    // Create a user object- create entry in db
    const user= await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // Remove password and refresh token field from response
    
    const createdUser= await User.findById(user._id).select("-password -refreshToken")

    // Check for user creation

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // Return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered SUccesfully")
    )

})

const loginUser= asyncHandler(async (req, res)=>{
    // req body ->data
    //  username or email

    const {email, username, password}= req.body;

    if(!username || !email){
        throw new ApiError(400, "Username or email is required");
    }

    // find the user
    const user= await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }
    // password check

    const isPasswordValid= await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(404, "Invalid User credentials")
    }
    // access and refresh token
    const {accessToken, refreshToken}=
    await generateAccessAndRefreshTokens(user._id);

    const loggedInUser= await User.findById(user._id).select("-password -refreshToken");

    // send cookie
    const options= {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged in Successfully"
        )
    )
})

const logoutUser= asyncHandler(async (req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options= {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out successfully"))
    
})

export {registerUser, loginUser, logoutUser};