const express = require("express");
const {
  updateProfile,
  getAllUsers,
  getUserById,
  subscribePush,
  unsubscribePush,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const upload = require("../config/upload");

const router = express.Router();

router.use(protect);

router.get("/", getAllUsers);
router.post("/push-subscribe", subscribePush);
router.delete("/push-subscribe", unsubscribePush);
router.get("/:id", getUserById);
router.put("/profile", upload.single("profilePicture"), updateProfile);

module.exports = router;
