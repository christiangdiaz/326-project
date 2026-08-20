import mongoose from "mongoose";

import {
  DEFAULT_REPORT_STATUS,
  REPORT_STATUSES
} from "../constants/reportStatus.js";

const reportSchema = new mongoose.Schema(
  {
    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    ownerId: {
      type: String,
      index: true
    },
    status: {
      type: String,
      // Single source of truth, shared with the service layer. Importing it
      // from a constants module rather than from either side keeps the two
      // in step without the service having to import from this file, which
      // jest.unstable_mockModule replaces wholesale in the test suite.
      enum: REPORT_STATUSES,
      default: DEFAULT_REPORT_STATUS,
      index: true
    }
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);

export async function getAll() {
  return Report.find().sort({ createdAt: -1 }).lean();
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Report.findById(id).lean();
}

export async function create(data) {
  const created = await Report.create(data);
  return created.toObject();
}

export async function updateById(id, updates) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Report.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  }).lean();
}

export async function removeById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Report.findByIdAndDelete(id).lean();
}
