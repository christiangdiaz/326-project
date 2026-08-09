import User from "../models/userModel.js";

export function findByEmail(email) {
  return User.findOne({ email }).lean();
}

export function create(data) {
  return User.create(data);
}