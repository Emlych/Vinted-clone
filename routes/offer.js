const express = require("express");
const formidableMiddleware = require("express-formidable");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

//Import models
const Offer = require("../models/Offer");
const User = require("../models/User");

//Credentials for cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//Token exists ?
const isAuthenticated = async (req, res, next) => {
  const tokenRegistered = req.headers.authorization;
  if (tokenRegistered) {
    const isTokenValid = await User.findOne({
      token: tokenRegistered.replace("Bearer ", ""),
    });
    if (isTokenValid) {
      console.log("Valid token, authorized to create an offer");
      next();
    } else {
      res.status(400).json("Unauthorized");
    }
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

//Publish offer (create offer)
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  console.log("route: /offer/publish");
  const targetUser = await User.findById(req.fields.userId);
  console.log("targetUser ===>", targetUser);
  try {
    //create new offer
    const newOffer = new Offer({
      product_name: req.fields.title,
      product_description: req.fields.description,
      product_price: req.fields.price,
      product_details: [
        { MARQUE: req.fields.brand },
        { TAILLE: req.fields.size },
        { ETAT: req.fields.condition },
        { COULEUR: req.fields.color },
        { EMPLACEMENT: req.fields.city },
      ],
      //product_image: result,
      owner: targetUser,
    });

    //upload photo on cloudinary
    const pictureToUpload = req.files.picture.path;
    const result = await cloudinary.uploader.upload(pictureToUpload, {
      public_id: `vinted/offers/${newOffer._id}`,
    });

    if (pictureToUpload) newOffer["product_image"] = result;

    await newOffer.save();
    res.json(newOffer);
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//Read offer with filter
router.get("/offers", async (req, res) => {
  console.log("route: /offers");

  //Mon objet filtersObject viendra récupérer les différents filtres.
  const filteredObjet = {};

  //tri des offres à partir du titre
  if (req.query.title) {
    filteredObjet.product_name = new RegExp(`${req.query.title}`, "i");
  }
  //tri des offres sur une fourchette de prix
  if (req.query.priceMin) {
    filteredObjet.product_price = { $gte: req.query.priceMin };
  }
  if (req.query.priceMax) {
    if (filteredObjet.product_price) {
      filteredObjet.product_price.$lte = req.query.priceMax;
    } else {
      filteredObjet.product_price = {
        $lte: req.query.priceMax,
      };
    }
  }

  //tri des offres par ordre de prix croissant ou décroissant
  const sortObject = { product_price: "asc" };
  req.query.sort === "desc"
    ? (sortObject.product_price = "desc")
    : (sortObject.product_price = "asc");

  //valeur par défaut de limit
  let limit = 20;
  req.query.limit ? (limit = req.query.limit) : (limit = 20);

  //valeur par défaut de page
  let page = 1;
  req.query.page ? (page = req.query.page) : (page = 1);

  //Tri des offres
  const offers = await Offer.find(filteredObjet)
    .populate({ path: "owner", select: "account" })
    .sort(sortObject)
    .skip((page - 1) * limit)
    .limit(limit);
  //.select("product_name product_price");
  console.log("offers ===>", offers[0].owner.account);

  //Nombre de documents dans la base
  const count = await Offer.countDocuments(filteredObjet);
  //Affichage du résultat
  res.json({ count: count, offers: offers });
});

//Update offer
router.put("/offer/update", isAuthenticated, async (req, res) => {
  console.log("route: /offer/update");

  try {
    if (!req.fields.objectId) {
      res.status(402).json({ error: { message: "Unknown offer" } });
    } else {
      const targetOffer = await Offer.findByIdAndUpdate(
        req.fields.objectId,
        {
          product_name: req.fields.title,
          product_description: req.fields.description,
          product_price: req.fields.price,
          product_details: [
            { MARQUE: req.fields.brand },
            { TAILLE: req.fields.size },
            { ETAT: req.fields.condition },
            { COULEUR: req.fields.color },
            { EMPLACEMENT: req.fields.city },
          ],
        },
        { new: true }
      );
      await targetOffer.save();
      res.json({ message: "Offer updated", offer: targetOffer });
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//Delete offer
router.delete("/offer/delete", isAuthenticated, async (req, res) => {
  console.log("route: /offer/delete");
  try {
    const offerExist = await Offer.findById(req.query.objectId);
    if (!offerExist) {
      res.status(402).json({ error: { message: "Offer doesn't exist" } });
    } else {
      await Offer.findByIdAndDelete(req.query.objectId);
      res.json({ error: { message: "Offer was deleted" } });
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//Get offer detail for a given id
router.get("/offer/:id", async (req, res) => {
  console.log("route: /offer/:id");
  try {
    const offer = await Offer.findById(req.params.id).populate({
      path: "owner",
      select: "account.username account.phone account.avatar",
    });
    res.json(offer);
  } catch (error) {
    res.status(400).json(error.message);
  }
});

module.exports = router;
