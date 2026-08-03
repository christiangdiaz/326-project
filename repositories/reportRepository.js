import mongoose from "mongoose";

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
    status: {
      type: String,
      // Kept in sync with ALLOWED_STATUSES in services/reportService.js.
      // Deliberately duplicated rather than shared: the service must not
      // import constants from this module, or jest.unstable_mockModule
      // would replace them with undefined in every test.
      enum: ["Open", "In Progress", "Resolved"],
      default: "Open",
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
