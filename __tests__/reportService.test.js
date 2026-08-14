import { jest } from "@jest/globals";

// The mock must be registered BEFORE the service is imported. A static
// `import` of the service would be hoisted above this call and would load
// the real repository, which pulls in Mongoose and tries to open a
// connection. The dynamic import below is what keeps this suite offline.
const repo = {
  getAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  removeById: jest.fn()
};

jest.unstable_mockModule(
  "../repositories/reportRepository.js",
  () => repo
);

const {
  getReports,
  addReport,
  updateReportStatus,
  deleteReport
} = await import("../services/reportService.js");

const openReport = {
  _id: "68a1f3c2d4e5f60718293a4b",
  unit: "2C",
  description: "Leaky sink",
  status: "Open"
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getReports", () => {
  test("returns whatever the repository returns", async () => {
    repo.getAll.mockResolvedValue([openReport]);

    await expect(getReports()).resolves.toEqual([openReport]);
    expect(repo.getAll).toHaveBeenCalledTimes(1);
  });
});

describe("addReport — required fields", () => {
  test("rejects a missing unit", async () => {
    await expect(
      addReport({ description: "Leaky sink" })
    ).rejects.toThrow("Unit number and description are required.");

    expect(repo.create).not.toHaveBeenCalled();
  });

  test("rejects a whitespace-only unit", async () => {
    await expect(
      addReport({ unit: "   ", description: "Leaky sink" })
    ).rejects.toThrow("Unit number and description are required.");

    expect(repo.create).not.toHaveBeenCalled();
  });

  test("rejects a missing description", async () => {
    await expect(addReport({ unit: "2C" })).rejects.toThrow(
      "Unit number and description are required."
    );

    expect(repo.create).not.toHaveBeenCalled();
  });

  test("rejects a whitespace-only description", async () => {
    await expect(
      addReport({ unit: "2C", description: "   " })
    ).rejects.toThrow("Unit number and description are required.");

    expect(repo.create).not.toHaveBeenCalled();
  });

  test("rejects a call with no argument at all", async () => {
    await expect(addReport()).rejects.toThrow(
      "Unit number and description are required."
    );

    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("addReport — length limits", () => {
  test("rejects a unit longer than 10 characters", async () => {
    await expect(
      addReport({ unit: "A".repeat(11), description: "Leaky sink" })
    ).rejects.toThrow("Unit number must be 10 characters or fewer.");

    expect(repo.create).not.toHaveBeenCalled();
  });

  test("rejects a description longer than 500 characters", async () => {
    await expect(
      addReport({ unit: "2C", description: "x".repeat(501) })
    ).rejects.toThrow("Description must be 500 characters or fewer.");

    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("addReport — normalization and defaults", () => {
  test("trims both fields and uppercases the unit", async () => {
    repo.create.mockResolvedValue(openReport);

    await addReport({ unit: "  2c  ", description: "  Leaky sink  " });

    expect(repo.create).toHaveBeenCalledWith({
      unit: "2C",
      description: "Leaky sink",
      status: "Open"
    });
  });

  test("forces status to Open, ignoring a client-supplied status", async () => {
    repo.create.mockResolvedValue(openReport);

    await addReport({
      unit: "2C",
      description: "Leaky sink",
      status: "Resolved"
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Open" })
    );
  });

  test("returns the created report on success", async () => {
    repo.create.mockResolvedValue(openReport);

    await expect(
      addReport({ unit: "2C", description: "Leaky sink" })
    ).resolves.toEqual(openReport);
  });
});

describe("updateReportStatus", () => {
  test("rejects a missing id", async () => {
    await expect(
      updateReportStatus(undefined, "Resolved")
    ).rejects.toThrow("Report id is required.");

    expect(repo.updateById).not.toHaveBeenCalled();
  });

  test("rejects a status outside the allowed list", async () => {
    await expect(
      updateReportStatus(openReport._id, "Cancelled")
    ).rejects.toThrow(
      "Status must be one of: Open, In Progress, Resolved."
    );

    expect(repo.updateById).not.toHaveBeenCalled();
  });

  test("throws when the report does not exist", async () => {
    repo.updateById.mockResolvedValue(null);

    await expect(
      updateReportStatus("68a1f3c2d4e5f60718293a4c", "Resolved")
    ).rejects.toThrow("Report not found.");
  });

  test("updates a valid status through the repository", async () => {
    repo.updateById.mockResolvedValue({
      ...openReport,
      status: "In Progress"
    });

    const result = await updateReportStatus(
      openReport._id,
      "In Progress"
    );

    expect(repo.updateById).toHaveBeenCalledWith(openReport._id, {
      status: "In Progress"
    });
    expect(result.status).toBe("In Progress");
  });
});

describe("deleteReport", () => {
  const owner = {
    id: "user-1",
    role: "member"
  };

  const otherUser = {
    id: "user-2",
    role: "member"
  };

  const admin = {
    id: "admin-1",
    role: "admin"
  };

  const ownedReport = {
    ...openReport,
    ownerId: "user-1"
  };

  test("rejects a missing id", async () => {
    await expect(
      deleteReport("", owner)
    ).rejects.toThrow("Report id is required.");

    expect(repo.removeById).not.toHaveBeenCalled();
  });

  test("throws when the report does not exist", async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      deleteReport(
        "68a1f3c2d4e5f60718293a4c",
        owner
      )
    ).rejects.toThrow("Report not found.");

    expect(repo.removeById).not.toHaveBeenCalled();
  });

  test("owner can delete their report", async () => {
    repo.findById.mockResolvedValue(ownedReport);
    repo.removeById.mockResolvedValue(ownedReport);

    await expect(
      deleteReport(openReport._id, owner)
    ).resolves.toEqual(ownedReport);

    expect(repo.removeById).toHaveBeenCalledWith(
      openReport._id
    );
  });

  test("another member cannot delete the report", async () => {
    repo.findById.mockResolvedValue(ownedReport);

    await expect(
      deleteReport(openReport._id, otherUser)
    ).rejects.toThrow("Forbidden.");

    expect(repo.removeById).not.toHaveBeenCalled();
  });

  test("admin can delete any report", async () => {
    repo.findById.mockResolvedValue(ownedReport);
    repo.removeById.mockResolvedValue(ownedReport);

    await expect(
      deleteReport(openReport._id, admin)
    ).resolves.toEqual(ownedReport);

    expect(repo.removeById).toHaveBeenCalledWith(
      openReport._id
    );
  });
});