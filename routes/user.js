const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const User = require("../models/User");

//Password management
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");

//Credentials for cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//Create a new User
router.post("/user/signup", async (req, res) => {
  console.log("route: /user/signup");
  try {
    //check if username was provided
    if (!req.fields.username) {
      res.status(400).json({ message: "No username provided" });
    }
    //check if email does already exist
    else if (await User.findOne({ email: req.fields.email })) {
      res.status(400).json({ message: "User already exists" });
    }
    //no problem encountered
    else {
      //generate hash et token
      const password = req.fields.password;
      const newSalt = uid2(16);
      const newHash = SHA256(password + newSalt).toString(encBase64);
      const newToken = uid2(16);

      //register new user
      const newUser = new User({
        email: req.fields.email,
        account: {
          username: req.fields.username,
          phone: req.fields.phone,
        },
        token: newToken,
        hash: newHash,
        salt: newSalt,
      });

      //upload photo on cloudinary
      const pictureToUpload = req.files.picture.path;
      if (pictureToUpload) {
        const result = await cloudinary.uploader.upload(pictureToUpload, {
          public_id: `vinted/users/${newUser._id}`,
        });
        newUser.account["avatar"] = result;
      }

      await newUser.save();

      res.json({
        _id: newUser._id,
        email: newUser.email,
        token: newUser.token,
        account: newUser.account,
      });
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//Login
router.post("/user/login", async (req, res) => {
  console.log("route: /user/login");
  try {
    //Find user with provided email
    const searchedUser = await User.findOne({ email: req.fields.email });

    //compare hash
    if (searchedUser === null) {
      res.status(401).json({ error: { message: "Unauthorized" } });
    } else {
      //transform provided password into hash
      //get hash and token
      const password = req.fields.password;
      const userSalt = searchedUser.salt;
      const newHash = SHA256(password + userSalt).toString(encBase64);
      if (newHash === searchedUser["hash"]) {
        res.json({ message: "You can login", searchedUser });
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

module.exports = router;
