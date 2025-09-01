const express = require("express");
const sizePredictorRouter = express.Router();
const {
  getSizePredictor,
} = require("../controllers/sizePredictorController.js");

sizePredictorRouter.post("/sizePredictor", getSizePredictor);


module.exports =  sizePredictorRouter;