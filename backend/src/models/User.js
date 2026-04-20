import mongoose from "mongoose";

const ROLES = ["candidate", "staff", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true, default: "" },
    avatarUrl: { type: String, trim: true, default: "" },
    activeStatus: { type: Boolean, default: true },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      default: "candidate",
    },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const USER_ROLES = ROLES;
